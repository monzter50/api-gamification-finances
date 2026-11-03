import type { Response, NextFunction } from 'express';
import { type AuthenticatedRequest } from '../types';
import { screenshotImportService } from '../services/screenshotImport/screenshotImport.service';
import { type ScreenshotImportPayload } from '../services/screenshotImport/types';

/**
 * Screenshot Import Controller
 * POST /api/transactions/import/screenshots/check — which image hashes were already imported
 * POST /api/transactions/import/screenshots       — idempotent import of parsed rows
 */
export class ScreenshotImportController {
  async check (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sha256s } = req.body as { sha256s: string[] };
      const imported = await screenshotImportService.findImportedImages(req.user!.userId, sha256s);
      res.status(200).json({
        success: true,
        message: 'Screenshot hashes checked',
        data: { imported }
      });
    } catch (error) {
      next(error);
    }
  }

  async import (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as ScreenshotImportPayload;
      // Whitelist the contract: never pass unknown body fields down.
      const payload: ScreenshotImportPayload = {
        accountId: body.accountId,
        images: body.images.map((image) => ({
          sha256: image.sha256,
          rows: image.rows.map((r) => ({
            day: r.day,
            month: r.month,
            time: r.time,
            rawDescriptor: r.rawDescriptor,
            amount: r.amount,
            type: r.type,
            ...(r.description !== undefined ? { description: r.description } : {})
          }))
        }))
      };
      const result = await screenshotImportService.importBatch(req.user!.userId, payload);
      res.status(201).json({
        success: true,
        message: 'Screenshots imported',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

export const screenshotImportController = new ScreenshotImportController();
