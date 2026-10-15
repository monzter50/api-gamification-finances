import type { Response, NextFunction } from 'express';
import { type AuthenticatedRequest } from '../types';
import { xlsxImportService } from '../services/xlsxImport/xlsxImport.service';
import { type ConfirmXlsxPayload } from '../services/xlsxImport/types';
import { NoFileUploadedError } from '../errors/XlsxImportErrors';

/**
 * Excel Import Controller
 * POST /api/transactions/import/xlsx/parse    — upload .xlsx, get parsed rows
 * POST /api/transactions/import/xlsx/confirm  — bulk-create the reviewed batch
 */
export class XlsxImportController {
  async parse (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
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
      next(error);
    }
  }

  async confirm (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
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
      next(error);
    }
  }
}

export const xlsxImportController = new XlsxImportController();
