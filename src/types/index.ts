import { type Request } from 'express';
import { type ApiTokenScope } from './apiToken.types';

/**
 * Shared, app-wide types.
 *
 * Resource-specific types live next to their feature:
 *   - src/types/account.types.ts
 *   - src/types/budget.types.ts
 *   - src/types/transaction.types.ts
 *
 * Persistence types come from Prisma (`import { User } from '@prisma/client'`)
 * — do NOT redefine model shapes here.
 */

/**
 * Decoded JWT payload attached to `req.user` by `authenticateJWT`.
 */
export interface JWTPayload {
  id: string
  userId: string
  email: string
  name: string
  /** Active session id this token was minted for (single-session enforcement). */
  sid: string
  iat: number
  exp: number
}

/**
 * Who is calling, attached to `req.user` by the auth middleware.
 *  - `session`: a signed-in app user (JWT). Carries the session id.
 *  - `api_token`: a personal API token (MCP server, scripts). Carries its scopes.
 * Controllers only need `userId`; the rest is for the auth layer and logs.
 */
export type AuthUser = {
  id: string
  userId: string
  email: string
  name: string
} & (
  | { authMethod: 'session', sid: string }
  | { authMethod: 'api_token', apiTokenId: string, scopes: ApiTokenScope[] }
);

/**
 * Express Request widened with the authenticated caller.
 * Use this in routes/controllers that sit behind `authenticateJWT` or
 * `authenticateUserOrApiToken`.
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthUser
}

/**
 * Canonical JSON envelope returned by every endpoint.
 * Also referenced by name in `swagger.config.ts` for OpenAPI generation.
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data?: T
  error?: unknown
}
