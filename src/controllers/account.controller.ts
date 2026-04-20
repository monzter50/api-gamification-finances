import { type Response } from 'express';
import { validationResult } from 'express-validator';
import { accountService } from '../services/account.service';
import { type AccountRequest, type CreateAccountBody, type UpdateAccountBody } from '../types/account.types';

export class AccountController {
  async getUserAccounts(req: AccountRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const accounts = await accountService.getUserAccounts(userId);

      // Per-user, short-lived browser cache. `private` keeps it out of any
      // shared/CDN cache (balances are user-scoped). 60s is enough to absorb
      // a form re-open burst but short enough that a stale balance heals
      // quickly on its own even if the client forgets to invalidate.
      res.set('Cache-Control', 'private, max-age=60');

      res.status(200).json({
        success: true,
        data: accounts,
        message: 'Accounts retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message, statusCode: 500 });
    }
  }

  async getAccountById(req: AccountRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const account = await accountService.getAccountById(id, userId);
      res.status(200).json({
        success: true,
        data: account,
        message: 'Account retrieved successfully'
      });
    } catch (error) {
      const message = (error as Error).message;
      if (message === 'Account not found') {
        res.status(404).json({ success: false, error: message, statusCode: 404 });
        return;
      }
      res.status(500).json({ success: false, error: message, statusCode: 500 });
    }
  }

  async createAccount(req: AccountRequest<CreateAccountBody>, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    try {
      const userId = req.user!.userId;
      const account = await accountService.createAccount(userId, req.body);
      res.status(201).json({
        success: true,
        data: account,
        message: 'Account created successfully'
      });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message, statusCode: 500 });
    }
  }

  async updateAccount(req: AccountRequest<UpdateAccountBody>, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const account = await accountService.updateAccount(id, userId, req.body);
      res.status(200).json({
        success: true,
        data: account,
        message: 'Account updated successfully'
      });
    } catch (error) {
      const message = (error as Error).message;
      if (message === 'Account not found') {
        res.status(404).json({ success: false, error: message, statusCode: 404 });
        return;
      }
      res.status(500).json({ success: false, error: message, statusCode: 500 });
    }
  }

  async deleteAccount(req: AccountRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const account = await accountService.deleteAccount(id, userId);
      res.status(200).json({
        success: true,
        data: account,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      const message = (error as Error).message;
      if (message === 'Account not found') {
        res.status(404).json({ success: false, error: message, statusCode: 404 });
        return;
      }
      if (message === 'Cannot delete account with existing transactions') {
        res.status(409).json({ success: false, error: message, statusCode: 409 });
        return;
      }
      res.status(500).json({ success: false, error: message, statusCode: 500 });
    }
  }
}

export const accountController = new AccountController();
