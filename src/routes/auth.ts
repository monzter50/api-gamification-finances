import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authController } from '../controllers/auth.controller';
import { registerValidation, loginValidation } from '../validators/auth.validator';
import { validate } from '../middleware/validate';
import { isTokenBlacklisted } from '../utils/tokenUtils';
import { userRepository } from '../repositories/user.repository';
import { type AuthenticatedRequest } from '../types';

const router = express.Router();

// Only refresh sessionLastActivityAt when it's older than this, to bound the
// per-request write to ~once/minute per active user.
const ACTIVITY_TOUCH_THROTTLE_MS = 60 * 1000;

// Auth middleware
export async function authenticateJWT (req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Unauthorized', errorCode: 'UNAUTHORIZED' });
    return;
  }
  const token: string = authHeader.split(' ')[1]!;
  try {
    // Check if token is blacklisted
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      res.status(401).json({ success: false, message: 'Token has been revoked', errorCode: 'TOKEN_BLACKLISTED' });
      return;
    }

    const JWT_SECRET = process.env.JWT_SECRET ?? 'default_secret';
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Single active session: the token is only valid for the user's CURRENT
    // session. A mismatch means a newer login superseded this one.
    const user = await userRepository.findByIdWithoutPassword(decoded.userId);
    if (!user) {
      res.status(401).json({ success: false, message: 'User not found', errorCode: 'USER_NOT_FOUND' });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({ success: false, message: 'Account is deactivated. Please contact support.', errorCode: 'ACCOUNT_DEACTIVATED' });
      return;
    }
    if (decoded.sid !== user.sessionId) {
      // 440 is reserved for "session superseded" so the SPA can tell it apart
      // from an ordinary 401 (which @aglaya/api-core surfaces only as a status).
      res.status(440).json({ success: false, message: 'Your session was ended because your account was used on another device.', errorCode: 'SESSION_REVOKED' });
      return;
    }

    // Slide the inactivity window forward (throttled).
    const lastActivity = user.sessionLastActivityAt;
    if (!lastActivity || Date.now() - new Date(lastActivity).getTime() > ACTIVITY_TOUCH_THROTTLE_MS) {
      await userRepository.touchSessionActivity(decoded.userId);
    }

    (req as AuthenticatedRequest).user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid token', errorCode: 'INVALID_TOKEN' });
  }
}

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     description: |
 *       Creates a new user account and returns a JWT for immediate use — the
 *       client does not need to call `/auth/login` after a successful register.
 *       Email is normalized (lowercased + trimmed) by validation before storage.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RegisterRequest' }
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/RegisterResponse' }
 *       400: { $ref: '#/components/responses/BadRequestError' }
 *       409:
 *         description: A user with this email already exists
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *             example:
 *               success: false
 *               message: 'User with this email already exists'
 *               errorCode: 'USER_ALREADY_EXISTS'
 */
router.post('/register', registerValidation, validate, authController.register.bind(authController));

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Log in with email + password
 *     description: |
 *       Returns a JWT on success. **Both "user not found" and "wrong password"
 *       intentionally return 401 with the same `INVALID_CREDENTIALS` errorCode**
 *       to avoid leaking which emails are registered. Do not surface a
 *       different UX for the two cases on the frontend.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LoginRequest' }
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/LoginResponse' }
 *       400: { $ref: '#/components/responses/BadRequestError' }
 *       401:
 *         description: Invalid credentials (user not found OR wrong password)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *             example:
 *               success: false
 *               message: 'Invalid email or password'
 *               errorCode: 'INVALID_CREDENTIALS'
 *       403:
 *         description: Account is deactivated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *             example:
 *               success: false
 *               message: 'Account is deactivated. Please contact support.'
 *               errorCode: 'ACCOUNT_DEACTIVATED'
 *       409:
 *         description: |
 *           Single active session — the user already has a session that has
 *           been active within the inactivity window. They must log out of the
 *           other session (or let it go idle) before signing in again.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *             example:
 *               success: false
 *               message: 'You already have an active session on another device. Log out there or wait a few minutes, then try again.'
 *               errorCode: 'SESSION_ALREADY_ACTIVE'
 */
router.post('/login', loginValidation, validate, authController.login.bind(authController));

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: Log out (blacklist the current token)
 *     description: |
 *       Adds the bearer token to a DB-backed blacklist so it cannot be reused,
 *       even before its natural expiry. Subsequent requests with the same
 *       token receive 401 `TOKEN_BLACKLISTED` from `authenticateJWT`.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully; token has been invalidated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/LogoutResponse' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 */
router.post('/logout', authenticateJWT, authController.logout.bind(authController));

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: Get the authenticated user's profile
 *     description: |
 *       Returns the full profile of the user identified by the bearer token.
 *       Use this on app startup to hydrate the auth store after a page refresh.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties:
 *                     success: { type: boolean, example: true }
 *                 - $ref: '#/components/schemas/UserProfile'
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       404:
 *         description: Authenticated user no longer exists in the database
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/me', authenticateJWT, authController.getCurrentUser.bind(authController));

export { router as authRoutes };
