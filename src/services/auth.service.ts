import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { userRepository } from '../repositories/user.repository';
import { type RegisterRequestDto, type LoginRequestDto } from '../dto/request/auth.dto';
import { type AuthResponseDto, type LogoutResponseDto } from '../dto/response/auth.dto';
import { blacklistToken, isTokenBlacklisted } from '../utils/tokenUtils';
import { logger } from '../config/logger';
import {
  InvalidCredentialsError,
  AccountDeactivatedError,
  UserNotFoundError,
  UserAlreadyExistsError,
  TokenBlacklistedError,
  SessionRevokedError,
  SessionAlreadyActiveError
} from '../errors/AuthErrors';

/**
 * A session counts as "active" (and therefore blocks a new login) only while it
 * has been used within this many minutes. Once it goes idle past the window, a
 * fresh login is allowed again — this prevents permanent lockout when a user
 * closes the app without logging out. Configurable via env.
 */
const SESSION_INACTIVITY_WINDOW_MIN = parseInt(
  process.env.SESSION_INACTIVITY_WINDOW_MIN ?? '20',
  10
);

/**
 * Is there a live session that should block a new login?
 * True when a sessionId exists and its last activity is within the window.
 */
function isSessionActive (
  sessionId: string | null | undefined,
  lastActivityAt: Date | null | undefined
): boolean {
  if (!sessionId || !lastActivityAt) {
    return false;
  }
  const windowMs = SESSION_INACTIVITY_WINDOW_MIN * 60 * 1000;
  return Date.now() - new Date(lastActivityAt).getTime() < windowMs;
}

/**
 * Authentication Service
 * Handles business logic for authentication operations
 */
export class AuthService {
  /**
   * Register a new user
   */
  async register (data: RegisterRequestDto): Promise<AuthResponseDto> {
    const { email, password, name } = data;

    // Check if user already exists
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new UserAlreadyExistsError();
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await userRepository.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      role: 'user'
    } as any);

    const userId = (user as any).id;

    // Open the first active session for this user.
    const sessionId = randomUUID();
    await userRepository.startSession(userId, sessionId);

    // Generate JWT token bound to the session
    const { token, expiresIn } = this.generateToken(userId, user.email, sessionId);

    logger.info(`New user registered: ${user.email}`);

    return {
      token,
      expiresIn,
      user: {
        id: userId,
        email: user.email,
        name: user.name,
        role: user.role
      }
    };
  }

  /**
   * Login user
   */
  async login (data: LoginRequestDto): Promise<AuthResponseDto> {
    const { email, password } = data;

    // Find user by email
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new InvalidCredentialsError();
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AccountDeactivatedError();
    }

    const userId = (user as any).id;

    // Single active session: block login while another session is still active
    // (used within the inactivity window). The user must log out there — or let
    // that session go idle — before signing in again.
    if (isSessionActive((user as any).sessionId, (user as any).sessionLastActivityAt)) {
      logger.info(`Login blocked, session already active: ${user.email}`);
      throw new SessionAlreadyActiveError();
    }

    // Open a new active session (also updates lastLogin). Any previously issued
    // token now carries a stale `sid` and will be rejected as SESSION_REVOKED.
    const sessionId = randomUUID();
    await userRepository.startSession(userId, sessionId);

    // Generate JWT token bound to the session
    const { token, expiresIn } = this.generateToken(userId, user.email, sessionId);

    logger.info(`User logged in: ${user.email}`);

    return {
      token,
      expiresIn
    };
  }

  /**
   * Logout user by blacklisting token
   */
  async logout (token: string, userId: string): Promise<LogoutResponseDto> {
    // Check if token is already blacklisted
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new TokenBlacklistedError('Token is already invalidated');
    }

    // Blacklist the token (tokenUtils will handle expiration extraction)
    await blacklistToken(token, userId);

    // Clear the active session so the single-session slot frees up immediately
    // and a fresh login is allowed without waiting for the inactivity window.
    await userRepository.clearSession(userId);

    logger.info(`User logged out: ${userId}`);

    return {
      message: 'Logout successful',
      success: true
    };
  }

  /**
   * Verify token and get user
   */
  async verifyToken (token: string): Promise<any> {
    // Check if token is blacklisted
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new TokenBlacklistedError();
    }

    // Verify JWT
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, jwtSecret) as any;

    // Get user from database
    const user = await userRepository.findByIdWithoutPassword(decoded.userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    if (!user.isActive) {
      throw new AccountDeactivatedError('User account is deactivated');
    }

    // Single-session: the token is only valid for the user's current session.
    if (decoded.sid !== (user as any).sessionId) {
      throw new SessionRevokedError();
    }

    return {
      userId: (user as any).id,
      email: user.email,
      role: user.role
    };
  }

  /**
   * Generate JWT token
   */
  /**
   * Generate JWT token
   */
  private generateToken (userId: string, email: string, sessionId: string): { token: string, expiresIn: number } {
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';

    const token = jwt.sign(
      { userId, email, id: userId, sid: sessionId },
      jwtSecret,
      { expiresIn: jwtExpiresIn } as jwt.SignOptions
    );

    // Decode to get expiration time
    const decoded = jwt.decode(token) as { exp: number, iat: number };
    const expiresIn = decoded.exp - decoded.iat;

    return { token, expiresIn };
  }
}

// Export singleton instance
export const authService = new AuthService();
