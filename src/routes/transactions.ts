import express from 'express';
import { transactionController } from '../controllers/transaction.controller';
import { statementImportController } from '../controllers/statementImport.controller';
import { authenticateJWT } from './auth';
import { validate } from '../middleware/validate';
import { statementUpload } from '../middleware/upload';
import {
  createTransactionValidation,
  updateTransactionValidation,
  transactionIdValidation,
  transactionQueryValidation,
  monthlySummaryValidation
} from '../validators/transaction.validator';
import { confirmImportValidation } from '../validators/statementImport.validator';

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

// Statement import — extract transactions from an uploaded image (no DB writes)
router.post(
  '/import/extract',
  authenticateJWT,
  statementUpload,
  statementImportController.extract.bind(statementImportController)
);

// Statement import — bulk-create the user-reviewed batch (atomic)
router.post(
  '/import/confirm',
  authenticateJWT,
  confirmImportValidation,
  validate,
  statementImportController.confirm.bind(statementImportController)
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
