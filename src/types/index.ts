import { type Request } from 'express';

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
  iat: number
  exp: number
}

/**
 * Express Request widened with the decoded JWT payload.
 * Use this in routes/controllers that sit behind `authenticateJWT`.
 */
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload
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
