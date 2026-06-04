import type { Response } from 'express';
import { type AuthenticatedRequest } from '../types';
import { xlsxImportService } from '../services/xlsxImport/xlsxImport.service';
import { type ConfirmXlsxPayload } from '../services/xlsxImport/types';
import { AuthError } from '../errors/AuthErrors';
import { NoFileUploadedError } from '../errors/XlsxImportErrors';
import { logger } from '../config/logger';

/**
 * Excel Import Controller
 * POST /api/transactions/import/xlsx/parse    — upload .xlsx, get parsed rows
 * POST /api/transactions/import/xlsx/confirm  — bulk-create the reviewed batch
 */
export class XlsxImportController {
  async parse (req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const file = req.file;
      if (!file) {
        throw new NoFileUploadedError();
      }
      const result = await xlsxImportService.parse(file.buffer);
      res.status(200).json({
        success: true,
        message: 'Workbook parsed successfully',
        data: result
      });
    } catch (error) {
      this.handleError(error, res, 'Error parsing workbook');
    }
  }

  async confirm (req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const payload = req.body as ConfirmXlsxPayload;
      const result = await xlsxImportService.confirmImport(userId, payload);
      res.status(201).json({
        success: true,
        message: 'Transactions imported successfully',
        data: result
      });
    } catch (error) {
      this.handleError(error, res, 'Error importing transactions');
    }
  }

  private handleError (error: unknown, res: Response, fallback: string): void {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ success: false, message: error.message, errorCode: error.errorCode });
      return;
    }
    const message = error instanceof Error ? error.message : fallback;
    if (message === 'Budget not found') {
      res.status(404).json({ success: false, message, errorCode: 'BUDGET_NOT_FOUND' });
      return;
    }
    if (message === 'Unauthorized access to budget' || message.includes('does not belong to user')) {
      res.status(403).json({ success: false, message, errorCode: 'FORBIDDEN' });
      return;
    }
    logger.error(`${fallback}:`, error);
    res.status(500).json({ success: false, message: fallback, errorCode: 'INTERNAL_ERROR' });
  }
}

export const xlsxImportController = new XlsxImportController();
