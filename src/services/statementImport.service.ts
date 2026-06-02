import { logger } from '../config/logger';
import { ExtractionFailedError, NoTransactionsFoundError } from '../errors/ImportErrors';
import { AuthError } from '../errors/AuthErrors';
import {
  transactionExtractor,
  type ExtractedTransaction
} from './extraction';
import {
  transactionService,
  type CreateTransactionInput
} from './transaction.service';
import { type EnhancedTransaction } from '../repositories/transaction.repository';

/** One reviewed row the user confirms for import (image-derived + optional overrides). */
export interface ConfirmImportRow {
  date: string
  amount: number
  vendor: string
  type: 'income' | 'expense'
  description?: string
  /** Per-row account override; falls back to the batch accountId. */
  accountId?: string
  incomeItemId?: string
  expenseItemId?: string
  installmentCurrent?: number
  installmentTotal?: number
  installmentOriginal?: number
}

export interface ConfirmImportPayload {
  budgetId: string
  accountId: string
  transactions: ConfirmImportRow[]
}

export interface ExtractTransactionsResult {
  transactions: ExtractedTransaction[]
  count: number
  source: 'mock' | 'claude'
  currencyHint?: string
}

export interface ConfirmImportResult {
  createdCount: number
  transactionIds: string[]
  transactions: EnhancedTransaction[]
}

/**
 * Statement Import Service
 *
 * Orchestrates the two-step "image → review → bulk-create" flow:
 *  1. extractTransactions — run the (mock/Claude) extractor on the uploaded
 *     image. No DB writes; the result is review fodder for the frontend.
 *  2. confirmImport — take the user-reviewed batch + chosen budget/account and
 *     atomically bulk-create the transactions (delegates to TransactionService
 *     so all balance/limit business rules are reused, not duplicated).
 */
export class StatementImportService {
  /** Step 1: extract transactions from a statement image (no persistence). */
  async extractTransactions (image: Buffer, mimeType: string): Promise<ExtractTransactionsResult> {
    let result;
    try {
      result = await transactionExtractor.extract(image, mimeType);
    } catch (error) {
      // Preserve typed extractor errors (e.g. EXTRACTION_UNAVAILABLE); wrap the rest.
      if (error instanceof AuthError) {
        throw error;
      }
      logger.error('Statement extraction failed', error);
      throw new ExtractionFailedError();
    }

    if (result.transactions.length === 0) {
      throw new NoTransactionsFoundError();
    }

    const out: ExtractTransactionsResult = {
      transactions: result.transactions,
      count: result.transactions.length,
      source: transactionExtractor.source
    };
    if (result.currencyHint !== undefined) {
      out.currencyHint = result.currencyHint;
    }
    return out;
  }

  /** Step 2: bulk-create the reviewed batch atomically. */
  async confirmImport (userId: string, payload: ConfirmImportPayload): Promise<ConfirmImportResult> {
    const { budgetId, accountId, transactions } = payload;

    // Merge batch-level budget/account into each row (row.accountId overrides).
    const rows: CreateTransactionInput[] = transactions.map((row) => {
      const merged: CreateTransactionInput = {
        budgetId,
        accountId: row.accountId ?? accountId,
        date: row.date,
        amount: row.amount,
        vendor: row.vendor,
        type: row.type
      };
      if (row.description !== undefined) merged.description = row.description;
      if (row.incomeItemId !== undefined) merged.incomeItemId = row.incomeItemId;
      if (row.expenseItemId !== undefined) merged.expenseItemId = row.expenseItemId;
      if (row.installmentCurrent !== undefined) merged.installmentCurrent = row.installmentCurrent;
      if (row.installmentTotal !== undefined) merged.installmentTotal = row.installmentTotal;
      if (row.installmentOriginal !== undefined) merged.installmentOriginal = row.installmentOriginal;
      return merged;
    });

    const created = await transactionService.bulkCreateTransactions(userId, rows);

    return {
      createdCount: created.length,
      transactionIds: created.map((t) => t.id),
      transactions: created
    };
  }
}

export const statementImportService = new StatementImportService();
