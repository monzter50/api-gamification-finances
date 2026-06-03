import express from 'express';
import { transactionController } from '../controllers/transaction.controller';
import { xlsxImportController } from '../controllers/xlsxImport.controller';
import { authenticateJWT } from './auth';
import { validate } from '../middleware/validate';
import { xlsxUpload } from '../middleware/xlsxUpload';
import {
  createTransactionValidation,
  updateTransactionValidation,
  transactionIdValidation,
  transactionQueryValidation,
  monthlySummaryValidation
} from '../validators/transaction.validator';
import { confirmXlsxValidation } from '../validators/xlsxImport.validator';

const router = express.Router();

/**
 * Transaction Routes
 * Base URL: /api/transactions
 */

// Get financial summary (must be before /:id)
router.get(
  '/summary',
  authenticateJWT,
  transactionController.getFinancialSummary.bind(transactionController)
);

// Get monthly summary (must be before /:id)
router.get(
  '/monthly/:year/:month',
  authenticateJWT,
  monthlySummaryValidation,
  validate,
  transactionController.getMonthlySummary.bind(transactionController)
);

// Get budget balance breakdown (must be before /:id)
router.get(
  '/budget/:budgetId/balance',
  authenticateJWT,
  transactionController.getBudgetBalance.bind(transactionController)
);

// Get all transactions (with optional filters & pagination)
router.get(
  '/',
  authenticateJWT,
  transactionQueryValidation,
  validate,
  transactionController.getAllTransactions.bind(transactionController)
);

// Get transaction by ID
router.get(
  '/:id',
  authenticateJWT,
  transactionIdValidation,
  validate,
  transactionController.getTransactionById.bind(transactionController)
);

// Excel import — parse an uploaded .xlsx (no DB writes)
router.post(
  '/import/xlsx/parse',
  authenticateJWT,
  xlsxUpload,
  xlsxImportController.parse.bind(xlsxImportController)
);

// Excel import — bulk-create the reviewed batch (atomic)
router.post(
  '/import/xlsx/confirm',
  authenticateJWT,
  confirmXlsxValidation,
  validate,
  xlsxImportController.confirm.bind(xlsxImportController)
);

// Create new transaction
router.post(
  '/',
  authenticateJWT,
  createTransactionValidation,
  validate,
  transactionController.createTransaction.bind(transactionController)
);

// Update transaction
router.put(
  '/:id',
  authenticateJWT,
  updateTransactionValidation,
  validate,
  transactionController.updateTransaction.bind(transactionController)
);

// Delete transaction
router.delete(
  '/:id',
  authenticateJWT,
  transactionIdValidation,
  validate,
  transactionController.deleteTransaction.bind(transactionController)
);

export { router as transactionRoutes };
