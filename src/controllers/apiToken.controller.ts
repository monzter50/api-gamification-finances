import type { Response, NextFunction } from 'express';
import { type AuthenticatedRequest } from '../types';
import { apiTokenService } from '../services/apiToken.service';
import { type ApiTokenScope } from '../types/apiToken.types';

/**
 * Personal API tokens — session-only endpoints (an API token can't mint,
 * list or revoke tokens).
 *   POST   /api/users/tokens            → create (raw token returned ONCE)
 *   GET    /api/users/tokens            → list active tokens (no secrets)
 *   DELETE /api/users/tokens/:tokenId   → revoke
 */
export class ApiTokenController {
  async create (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, scopes, expiresInDays } = req.body as { name: string, scopes: ApiTokenScope[], expiresInDays?: number };
      const created = await apiTokenService.create(req.user!.userId, {
        name,
        scopes,
        ...(expiresInDays !== undefined ? { expiresInDays } : {})
      });
      // The response carries a secret: never let a proxy or the browser cache it.
      res.set('Cache-Control', 'no-store');
      res.status(201).json({
        success: true,
        message: 'API token created. Copy it now — it won\'t be shown again.',
        data: created
      });
    } catch (error) {
      next(error);
    }
  }

  async list (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tokens = await apiTokenService.list(req.user!.userId);
      res.status(200).json({ success: true, message: 'API tokens', data: tokens });
    } catch (error) {
      next(error);
    }
  }

  async revoke (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tokenId } = req.params as { tokenId: string };
      await apiTokenService.revoke(req.user!.userId, tokenId);
      res.status(200).json({ success: true, message: 'API token revoked' });
    } catch (error) {
      next(error);
    }
  }
}

export const apiTokenController = new ApiTokenController();
