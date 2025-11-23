import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { userRepository } from '../repositories/user.repository';
import { userWalletRepository } from '../repositories/userWallet.repository';
import { userProgressRepository } from '../repositories/userProgress.repository';
import { userProfileRepository } from '../repositories/userProfile.repository';
import { RegisterRequestDto, LoginRequestDto } from '../dto/request/auth.dto';
import { AuthResponseDto, LogoutResponseDto } from '../dto/response/auth.dto';
import { blacklistToken, isTokenBlacklisted } from '../utils/tokenUtils';
import { logger } from '../config/logger';

/**
 * Authentication Service
 * Handles business logic for authentication operations
 */
export class AuthService {
  /**
   * Register a new user
   */
  async register(data: RegisterRequestDto): Promise<AuthResponseDto> {
    const { email, password, name } = data;

    // Check if user already exists
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new Error('User with this email already exists');
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

    const userId = (user._id as any).toString();

    // Create associated records for the new user
    await Promise.all([
      userWalletRepository.createForUser(userId, 0), // Start with 0 coins
      userProgressRepository.createForUser(userId), // Level 1, 0 XP
      userProfileRepository.createForUser(userId, 0) // 0 savings goal
    ]);

    // Fetch the created records
    const [wallet, progress] = await Promise.all([
      userWalletRepository.findByUserId(userId),
      userProgressRepository.findByUserId(userId)
    ]);

    // Generate JWT token
    const { token, expiresIn } = this.generateToken(userId, user.email);

    logger.info(`New user registered: ${user.email}`);

    return {
      token,
      expiresIn,
      user: {
        id: userId,
        email: user.email,
        name: user.name,
        role: user.role,
        level: progress?.level || 1,
        experience: progress?.experience || 0,
        coins: wallet?.coins || 0
      }
    };
  }

  /**
   * Login user
   */
  async login(data: LoginRequestDto): Promise<AuthResponseDto> {
    const { email, password } = data;

    // Find user by email
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is deactivated. Please contact support.');
    }

    const userId = (user._id as any).toString();

    // Update last login
    await userRepository.updateLastLogin(userId);



    // Generate JWT token
    const { token, expiresIn } = this.generateToken(userId, user.email);

    logger.info(`User logged in: ${user.email}`);

    return {
      token,
      expiresIn
    };
  }

  /**
   * Logout user by blacklisting token
   */
  async logout(token: string, userId: string): Promise<LogoutResponseDto> {
    // Check if token is already blacklisted
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new Error('Token is already invalidated');
    }

    // Blacklist the token (tokenUtils will handle expiration extraction)
    await blacklistToken(token, userId);

    logger.info(`User logged out: ${userId}`);

    return {
      message: 'Logout successful',
      success: true
    };
  }

  /**
   * Verify token and get user
   */
  async verifyToken(token: string): Promise<any> {
    // Check if token is blacklisted
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new Error('Token has been invalidated');
    }

    // Verify JWT
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, jwtSecret) as any;

    // Get user from database
    const user = await userRepository.findByIdWithoutPassword(decoded.userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isActive) {
      throw new Error('User account is deactivated');
    }

    return {
      userId: (user._id as any).toString(),
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
  private generateToken(userId: string, email: string): { token: string; expiresIn: number } {
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';

    const token = jwt.sign(
      { userId, email, id: userId },
      jwtSecret,
      { expiresIn: jwtExpiresIn } as jwt.SignOptions
    );

    // Decode to get expiration time
    const decoded = jwt.decode(token) as { exp: number; iat: number };
    const expiresIn = decoded.exp - decoded.iat;

    return { token, expiresIn };
  }
}

// Export singleton instance
export const authService = new AuthService();
