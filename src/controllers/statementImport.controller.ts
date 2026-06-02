import type { Response } from 'express';
import { type AuthenticatedRequest } from '../types';
import { statementImportService, type ConfirmImportPayload } from '../services/statementImport.service';
import { AuthError } from '../errors/AuthErrors';
import { NoFileUploadedError } from '../errors/ImportErrors';
import { logger } from '../config/logger';

/**
 * Statement Import Controller
 * POST /api/transactions/import/extract  — upload image, get extracted rows
 * POST /api/transactions/import/confirm  — bulk-create the reviewed batch
 */
export class StatementImportController {
  /** POST /api/transactions/import/extract (multipart, no DB writes) */
  async extract (req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const file = req.file;
      if (!file) {
        throw new NoFileUploadedError();
      }

      const result = await statementImportService.extractTransactions(file.buffer, file.mimetype);

      res.status(200).json({
        success: true,
        message: 'Transactions extracted successfully',
        data: result
      });
    } catch (error) {
      this.handleError(error, res, 'Error extracting transactions');
    }
  }

  /** POST /api/transactions/import/confirm (JSON, atomic bulk-create) */
  async confirm (req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const payload = req.body as ConfirmImportPayload;

      const result = await statementImportService.confirmImport(userId, payload);

      res.status(201).json({
        success: true,
        message: 'Transactions imported successfully',
        data: result
      });
    } catch (error) {
      this.handleError(error, res, 'Error importing transactions');
    }
  }

  /**
   * Map errors to responses. Typed AuthError subclasses (upload/extraction)
   * carry their own status + errorCode; the bulk-create path can also throw
   * plain Errors from TransactionService whose messages we map here.
   */
  private handleError (error: unknown, res: Response, fallback: string): void {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        errorCode: error.errorCode
      });
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
    if (message.includes('not found in this budget') || message.includes('exceeds remaining')) {
      res.status(400).json({ success: false, message, errorCode: 'INVALID_TRANSACTION' });
      return;
    }

    logger.error(`${fallback}:`, error);
    res.status(500).json({ success: false, message: fallback, errorCode: 'INTERNAL_ERROR' });
  }
}

export const statementImportController = new StatementImportController();
