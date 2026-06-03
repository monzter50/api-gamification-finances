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

/**
 * @openapi
 * /api/transactions/import/extract:
 *   post:
 *     tags: [Transactions]
 *     summary: Extract transactions from a statement image (no DB writes)
 *     description: |
 *       Uploads a statement image (JPEG/PNG/WebP) and returns the extracted
 *       transactions for review — nothing is persisted. Extraction runs behind
 *       a swappable provider: a mock extractor by default, or Claude vision when
 *       `ANTHROPIC_API_KEY` is set (and `USE_MOCK_EXTRACTION` is not `true`).
 *       `budgetId` / `accountId` are NOT returned — the user supplies them at
 *       confirm time. Max upload size is `MAX_UPLOAD_MB` (default 10).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The statement image (image/jpeg|png|webp).
 *     responses:
 *       200:
 *         description: Transactions extracted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date: { type: string, description: 'ISO date, or "" if unreadable', example: '2026-05-03' }
 *                           amount: { type: number, example: 84.20 }
 *                           vendor: { type: string, example: 'Whole Foods Market' }
 *                           type: { type: string, enum: [income, expense] }
 *                           description: { type: string }
 *                           confidence: { type: string, enum: [high, medium, low] }
 *                           sourceText: { type: string, description: 'Raw row text as read from the image' }
 *                     count: { type: integer }
 *                     source: { type: string, enum: [mock, claude] }
 *                     currencyHint: { type: string, example: 'MXN' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       413:
 *         description: File exceeds the upload size limit
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Error' }, example: { success: false, message: 'File exceeds the 10MB limit.', errorCode: 'FILE_TOO_LARGE' } } }
 *       415:
 *         description: Unsupported file type
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Error' }, example: { success: false, message: 'Unsupported file type. Upload a JPEG, PNG, or WebP image.', errorCode: 'UNSUPPORTED_FILE_TYPE' } } }
 *       422:
 *         description: No transactions found in the image
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Error' }, example: { success: false, message: 'No transactions were found in the uploaded image.', errorCode: 'NO_TRANSACTIONS_FOUND' } } }
 *       502:
 *         description: Extraction failed
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Error' }, example: { success: false, errorCode: 'EXTRACTION_FAILED' } } }
 *       503:
 *         description: Extraction provider unavailable (Claude selected but not configured)
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Error' }, example: { success: false, errorCode: 'EXTRACTION_UNAVAILABLE' } } }
 */
router.post(
  '/import/extract',
  authenticateJWT,
  statementUpload,
  statementImportController.extract.bind(statementImportController)
);

/**
 * @openapi
 * /api/transactions/import/confirm:
 *   post:
 *     tags: [Transactions]
 *     summary: Bulk-create the reviewed statement batch (atomic)
 *     description: |
 *       Creates the user-reviewed transactions in a single database transaction
 *       (all-or-nothing), reusing the standard create/rebalance logic. `budgetId`
 *       and `accountId` are batch-level; each row may override `accountId`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [budgetId, accountId, transactions]
 *             properties:
 *               budgetId: { type: string, format: uuid }
 *               accountId: { type: string, format: uuid }
 *               transactions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [date, amount, vendor, type]
 *                   properties:
 *                     date: { type: string, format: date-time }
 *                     amount: { type: number }
 *                     vendor: { type: string }
 *                     type: { type: string, enum: [income, expense] }
 *                     description: { type: string }
 *                     accountId: { type: string, format: uuid, description: 'Per-row override of the batch account' }
 *                     incomeItemId: { type: string, format: uuid }
 *                     expenseItemId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Transactions imported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     createdCount: { type: integer }
 *                     transactionIds: { type: array, items: { type: string, format: uuid } }
 *       400: { $ref: '#/components/responses/BadRequestError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403:
 *         description: Budget or account does not belong to the user
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
 *       404:
 *         description: Budget not found
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
 */
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
