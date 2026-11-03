import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { isTokenBlacklisted } from '../utils/tokenUtils';
import { looksLikeApiToken } from '../utils/apiToken';
import { userRepository } from '../repositories/user.repository';
import { apiTokenService } from '../services/apiToken.service';
import { type AuthenticatedRequest, type AuthUser, type JWTPayload } from '../types';
import { type ApiTokenScope } from '../types/apiToken.types';
import { getJwtSecret, JWT_ALGORITHM } from '../config/env';
import {
  AccountDeactivatedError,
  ApiTokenNotAllowedError,
  InsufficientScopeError,
  InvalidTokenError,
  SessionRevokedError,
  TokenBlacklistedError,
  TokenUserNotFoundError,
  UnauthorizedError
} from '../errors/AuthErrors';

// Only refresh sessionLastActivityAt when it's older than this, to bound the
// per-request write to ~once/minute per active user.
const ACTIVITY_TOUCH_THROTTLE_MS = 60 * 1000;

/** Methods a `read` token may call. Everything else needs `write`. */
type AsyncMiddleware = (req: Request, res: Response, next: NextFunction) => Promise<void>;

const READ_METHODS = new Set(['GET', 'HEAD']);

const bearerFrom = (req: Request): string => {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') === true ? header.slice('Bearer '.length).trim() : '';
};

/**
 * App session (JWT). Order: blacklist (logout) → signature/expiry (HS256
 * only) → user still exists and is active → token's `sid` is the user's
 * CURRENT session (single active session; a superseded token gets 440).
 */
async function authenticateSession (token: string): Promise<AuthUser> {
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

  return {
    id: decoded.id,
    userId: decoded.userId,
    email: decoded.email,
    name: decoded.name,
    authMethod: 'session',
    sid: decoded.sid
  };
}

/**
 * Personal API token. Deliberately does NOT touch the user's session
 * (`sid` / `sessionLastActivityAt`): an MCP server polling the API must not
 * block or end the user's web login, and logging out of the web app doesn't
 * revoke tokens (they're revoked explicitly, or expire).
 */
async function authenticateApiToken (req: Request, token: string): Promise<AuthUser> {
  const principal = await apiTokenService.authenticate(token);
  const required: ApiTokenScope = READ_METHODS.has(req.method) ? 'read' : 'write';
  if (!principal.scopes.includes(required)) {
    throw new InsufficientScopeError(required);
  }
  return {
    id: principal.userId,
    userId: principal.userId,
    email: principal.email,
    name: principal.name,
    authMethod: 'api_token',
    apiTokenId: principal.apiTokenId,
    scopes: principal.scopes
  };
}

/**
 * Build an auth middleware. API tokens are **opt-in per route**
 * (`allowApiToken`): a new endpoint is session-only unless someone decides
 * otherwise, so a leaked token can never reach token management, logout,
 * imports or integrations by accident.
 *
 * Failures are forwarded as typed errors so the global errorHandler renders
 * the standard error envelope.
 */
function createAuthenticator ({ allowApiToken }: { allowApiToken: boolean }): AsyncMiddleware {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = bearerFrom(req);
      if (token === '') {
        throw new UnauthorizedError();
      }

      let user: AuthUser;
      if (looksLikeApiToken(token)) {
        if (!allowApiToken) {
          throw new ApiTokenNotAllowedError();
        }
        user = await authenticateApiToken(req, token);
      } else {
        user = await authenticateSession(token);
      }

      (req as AuthenticatedRequest).user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** App session only (JWT). The default for every endpoint. */
export const authenticateJWT = createAuthenticator({ allowApiToken: false });

/**
 * App session OR personal API token. Use only on resource endpoints that are
 * safe to automate (accounts, transactions, budgets, profile reads). Scope is
 * enforced by HTTP method: GET/HEAD need `read`, anything else `write`.
 */
export const authenticateUserOrApiToken = createAuthenticator({ allowApiToken: true });
