import type { Response } from 'express';
import { type AuthenticatedRequest } from '../types';
import { receiptImportService } from '../services/receiptImport/receiptImport.service';
import type { AccountKind } from '../services/receiptImport/types';
import { AuthError } from '../errors/AuthErrors';
import { NoFileUploadedError } from '../errors/XlsxImportErrors';
import { logger } from '../config/logger';

/**
 * Bank Screenshot Import Controller
 * POST /api/transactions/import/receipt/parse — upload image(s), get draft rows
 *
 * Parse only. No database writes happen on this path.
 */
export class ReceiptImportController {
  async parse (req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const files = Array.isArray(req.files) ? req.files : [];
      if (files.length === 0) {
        throw new NoFileUploadedError('No image uploaded. Send one or more files in the "files" field.');
      }

      const { accountKind, referenceDate } = req.body as {
        accountKind?: string
        referenceDate?: string
      };

      // Defaults to a credit-card view: that is where the sign convention is
      // counter-intuitive, so it is the safer thing to assume and confirm.
      const kind: AccountKind = accountKind === 'debit' ? 'debit' : 'credit';
      const reference = referenceDate !== undefined ? new Date(referenceDate) : new Date();

      const result = await receiptImportService.parse(files, {
        accountKind: kind,
        referenceDate: Number.isNaN(reference.getTime()) ? new Date() : reference
      });

      res.status(200).json({
        success: true,
        message: 'Image parsed successfully',
        data: result
      });
    } catch (error) {
      this.handleError(error, res, 'Error parsing image');
    }
  }

  private handleError (error: unknown, res: Response, fallback: string): void {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        errorCode: error.errorCode
      });
      return;
    }
    logger.error(`${fallback}: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ success: false, message: fallback });
  }
}

export const receiptImportController = new ReceiptImportController();
