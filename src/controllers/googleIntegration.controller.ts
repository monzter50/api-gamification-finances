import type { Request, Response, NextFunction } from 'express';
import { type AuthenticatedRequest } from '../types';
import { googleSheetsExportService, type SyncFilters } from '../services/googleSheets/googleSheetsExport.service';

/**
 * Google Sheets export.
 *   GET    /api/integrations/google/connect      → consent URL (JWT)
 *   GET    /api/integrations/google/callback     → Google redirect (public, signed state)
 *   GET    /api/integrations/google/status       → connection status (JWT)
 *   POST   /api/integrations/google/sheet        → create a new spreadsheet (JWT)
 *   POST   /api/integrations/google/sheet/sync   → export transactions (JWT)
 *   DELETE /api/integrations/google              → disconnect + revoke (JWT)
 */
export class GoogleIntegrationController {
  async connect (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const url = googleSheetsExportService.getConnectUrl(req.user!.userId);
      // Not cacheable: the URL carries a short-lived, user-bound state.
      res.set('Cache-Control', 'no-store');
      res.status(200).json({ success: true, message: 'Open this URL to connect Google', data: { url } });
    } catch (error) {
      next(error);
    }
  }

  /** Browser navigation from Google — always answers with a redirect to the frontend. */
  async callback (req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, state, error } = req.query;
      const location = await googleSheetsExportService.handleCallback({ code, state, error });
      res.set('Cache-Control', 'no-store');
      res.redirect(302, location);
    } catch (error) {
      next(error);
    }
  }

  async status (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = await googleSheetsExportService.getStatus(req.user!.userId);
      res.status(200).json({ success: true, message: 'Google integration status', data: status });
    } catch (error) {
      next(error);
    }
  }

  async createSheet (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const ref = await googleSheetsExportService.createSpreadsheet(req.user!.userId);
      res.status(201).json({ success: true, message: 'Spreadsheet created', data: ref });
    } catch (error) {
      next(error);
    }
  }

  async sync (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to, budgetId } = req.body as { from?: string, to?: string, budgetId?: string };
      const filters: SyncFilters = {};
      if (from !== undefined) filters.from = new Date(from);
      // A date-only `to` ("2026-09-30") means "through the end of that day".
      if (to !== undefined) filters.to = /^\d{4}-\d{2}-\d{2}$/.test(to) ? new Date(`${to}T23:59:59.999Z`) : new Date(to);
      if (budgetId !== undefined) filters.budgetId = budgetId;

      const result = await googleSheetsExportService.sync(req.user!.userId, filters);
      res.status(200).json({ success: true, message: 'Transactions exported to Google Sheets', data: result });
    } catch (error) {
      next(error);
    }
  }

  async disconnect (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await googleSheetsExportService.disconnect(req.user!.userId);
      res.status(200).json({ success: true, message: 'Google account disconnected' });
    } catch (error) {
      next(error);
    }
  }
}

export const googleIntegrationController = new GoogleIntegrationController();
