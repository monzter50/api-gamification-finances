import { type Response, type NextFunction } from 'express';
import crypto from 'crypto';
import { accountService } from '../services/account.service';
import { type AccountRequest, type CreateAccountBody, type UpdateAccountBody } from '../types/account.types';

export class AccountController {
  async getUserAccounts (req: AccountRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const accounts = await accountService.getUserAccounts(userId);

      // Weak ETag derived from the account data only (not the response
      // envelope). Hashing the data — which includes `balance` — means the
      // tag flips the moment any transaction moves a balance, so the client
      // can't get stuck on a stale 304 after a mutation. SHA-1 is fine here:
      // this is a cache key, not a security primitive.
      const etag = 'W/"' + crypto
        .createHash('sha1')
        .update(JSON.stringify(accounts))
        .digest('hex') + '"';

      // Per-user, short-lived browser cache. `private` keeps it out of any
      // shared/CDN cache (balances are user-scoped). 60s is enough to absorb
      // a form re-open burst; after that, the client revalidates via ETag
      // and usually gets an empty 304.
      res.set('Cache-Control', 'private, max-age=60');
      res.set('ETag', etag);

      // Client already has this version — skip the body entirely.
      // Short-circuit here (rather than leaning on Express's auto-304)
      // because ETag is disabled globally in development (see server.ts)
      // and this must work in both environments.
      if (req.get('If-None-Match') === etag) {
        res.status(304).end();
        return;
      }

      res.status(200).json({
        success: true,
        data: accounts,
        message: 'Accounts retrieved successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async getAccountById (req: AccountRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params as { id: string };
      const account = await accountService.getAccountById(id, userId);
      res.status(200).json({
        success: true,
        data: account,
        message: 'Account retrieved successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async createAccount (req: AccountRequest<CreateAccountBody>, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const account = await accountService.createAccount(userId, req.body);
      res.status(201).json({
        success: true,
        data: account,
        message: 'Account created successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async updateAccount (req: AccountRequest<UpdateAccountBody>, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params as { id: string };
      const account = await accountService.updateAccount(id, userId, req.body);
      res.status(200).json({
        success: true,
        data: account,
        message: 'Account updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteAccount (req: AccountRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params as { id: string };
      const account = await accountService.deleteAccount(id, userId);
      res.status(200).json({
        success: true,
        data: account,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

export const accountController = new AccountController();
