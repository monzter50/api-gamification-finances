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

/**
 * @openapi
 * /api/transactions/import/xlsx/parse:
 *   post:
 *     tags: [Transactions]
 *     summary: Parse an uploaded .xlsx budget workbook (no DB writes)
 *     description: |
 *       Reads three sheets and returns the parsed rows for review — nothing is
 *       persisted:
 *         - "Budget track" → transactions (account resolved later from the
 *           `paymentSource` = "Payment Method / Card")
 *         - "Income"       → income items (description + amount; type/account
 *           are chosen in the review UI)
 *         - "Expenses"     → expense items (Fixed/Variable derived from the
 *           "Gastos Fijos / Gastos Variables" sections)
 *       Excel serial dates are converted to ISO. Max upload size is
 *       `MAX_UPLOAD_MB` (default 10).
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
 *                 description: The .xlsx workbook.
 *     responses:
 *       200:
 *         description: Workbook parsed successfully
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
 *                           date: { type: string, example: '2026-04-15' }
 *                           amount: { type: number, example: 699 }
 *                           vendor: { type: string, example: 'telcel' }
 *                           type: { type: string, enum: [income, expense] }
 *                           description: { type: string }
 *                           paymentSource: { type: string, example: 'Debits Cards / BBVA' }
 *                     incomeItems:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           description: { type: string }
 *                           amount: { type: number }
 *                     expenseItems:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           description: { type: string }
 *                           amount: { type: number }
 *                           type: { type: string, enum: [Fixed, Variable] }
 *                     paymentSources:
 *                       type: array
 *                       items: { type: string }
 *                     counts:
 *                       type: object
 *                       properties:
 *                         transactions: { type: integer }
 *                         incomeItems: { type: integer }
 *                         expenseItems: { type: integer }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       413:
 *         description: File exceeds the upload size limit
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *             example: { success: false, message: 'File exceeds the 10MB limit.', errorCode: 'FILE_TOO_LARGE' }
 *       415:
 *         description: Unsupported file type (not .xlsx)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *             example: { success: false, message: 'Unsupported file type. Upload an .xlsx Excel file.', errorCode: 'UNSUPPORTED_FILE_TYPE' }
 *       422:
 *         description: No transactions or budget items found in the workbook
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *             example: { success: false, message: 'No transactions or budget items were found in the workbook.', errorCode: 'NO_TRANSACTIONS_FOUND' }
 */
router.post(
  '/import/xlsx/parse',
  authenticateJWT,
  xlsxUpload,
  xlsxImportController.parse.bind(xlsxImportController)
);

/**
 * @openapi
 * /api/transactions/import/xlsx/confirm:
 *   post:
 *     tags: [Transactions]
 *     summary: Bulk-create the reviewed import (atomic)
 *     description: |
 *       Creates budget income items + expense items + transactions in a single
 *       database transaction (all-or-nothing). Each transaction's account is
 *       resolved from `accountMapping[paymentSource]`, falling back to
 *       `defaultAccountId`. Transactions move the account balance (income
 *       credits, expense debits); budget items do not.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [budgetId, defaultAccountId, transactions, incomeItems, expenseItems]
 *             properties:
 *               budgetId: { type: string, format: uuid }
 *               defaultAccountId: { type: string, format: uuid }
 *               accountMapping:
 *                 type: object
 *                 additionalProperties: { type: string, format: uuid }
 *                 description: '"Payment Method / Card" → accountId'
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
 *                     paymentSource: { type: string }
 *               incomeItems:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [description, amount, type, accountId]
 *                   properties:
 *                     description: { type: string }
 *                     amount: { type: number }
 *                     type: { type: string, example: 'Transfer' }
 *                     accountId: { type: string, format: uuid }
 *               expenseItems:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [description, amount, type]
 *                   properties:
 *                     description: { type: string }
 *                     amount: { type: number }
 *                     type: { type: string, enum: [Fixed, Variable] }
 *     responses:
 *       201:
 *         description: Imported successfully
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
 *                     createdCount:
 *                       type: object
 *                       properties:
 *                         transactions: { type: integer }
 *                         incomeItems: { type: integer }
 *                         expenseItems: { type: integer }
 *                     transactionIds:
 *                       type: array
 *                       items: { type: string, format: uuid }
 *       400: { $ref: '#/components/responses/BadRequestError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403:
 *         description: Budget or an account does not belong to the user
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Budget not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
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
