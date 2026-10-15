import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { isTokenBlacklisted } from '../utils/tokenUtils';
import { userRepository } from '../repositories/user.repository';
import { type AuthenticatedRequest, type JWTPayload } from '../types';
import { getJwtSecret, JWT_ALGORITHM } from '../config/env';
import {
  AccountDeactivatedError,
  InvalidTokenError,
  SessionRevokedError,
  TokenBlacklistedError,
  TokenUserNotFoundError,
  UnauthorizedError
} from '../errors/AuthErrors';

// Only refresh sessionLastActivityAt when it's older than this, to bound the
// per-request write to ~once/minute per active user.
const ACTIVITY_TOUCH_THROTTLE_MS = 60 * 1000;

/**
 * Authenticate a request via `Authorization: Bearer <jwt>`.
 *
 * Order: header → blacklist (logout) → signature/expiry (HS256 only) → user
 * still exists and is active → token's `sid` is the user's CURRENT session
 * (single active session; a superseded token gets 440 SESSION_REVOKED).
 *
 * Failures are forwarded as typed errors so the global errorHandler renders
 * the standard error envelope.
 */
export async function authenticateJWT (req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') === true ? authHeader.slice('Bearer '.length).trim() : '';
    if (token === '') {
      throw new UnauthorizedError();
    }

    if (await isTokenBlacklisted(token)) {
      throw new TokenBlacklistedError('Token has been revoked');
    }

    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, getJwtSecret(), { algorithms: [JWT_ALGORITHM] }) as JWTPayload;
    } catch {
      throw new InvalidTokenError('Invalid token');
    }

    const user = await userRepository.findByIdWithoutPassword(decoded.userId);
    if (user === null) {
      throw new TokenUserNotFoundError();
    }
    if (user.isActive !== true) {
      throw new AccountDeactivatedError();
    }
    // 440 is reserved for "session superseded" so the SPA can tell it apart
    // from an ordinary 401 (which @aglaya/api-core surfaces only as a status).
    if (decoded.sid !== user.sessionId) {
      throw new SessionRevokedError();
    }

    // Slide the inactivity window forward (throttled).
    const lastActivity = user.sessionLastActivityAt;
    if (lastActivity == null || Date.now() - new Date(lastActivity).getTime() > ACTIVITY_TOUCH_THROTTLE_MS) {
      await userRepository.touchSessionActivity(decoded.userId);
    }

    (req as AuthenticatedRequest).user = decoded;
    next();
  } catch (error) {
    next(error);
  }
}
