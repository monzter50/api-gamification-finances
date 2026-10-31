import express from 'express';
import { transactionController } from '../controllers/transaction.controller';
import { xlsxImportController } from '../controllers/xlsxImport.controller';
import { authenticateJWT, authenticateUserOrApiToken } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { xlsxUpload } from '../middleware/xlsxUpload';
import {
  createTransactionValidation,
  updateTransactionValidation,
  transactionIdValidation,
  transactionQueryValidation,
  monthlySummaryValidation,
  budgetBalanceValidation
} from '../validators/transaction.validator';
import { confirmXlsxValidation } from '../validators/xlsxImport.validator';
import { screenshotImportController } from '../controllers/screenshotImport.controller';
import { checkScreenshotsValidation, importScreenshotsValidation } from '../validators/screenshotImport.validator';

const router = express.Router();

/**
 * Transaction Routes
 * Base URL: /api/transactions
 */

// Get financial summary (must be before /:id)
router.get(
  '/summary',
  authenticateUserOrApiToken,
  transactionController.getFinancialSummary.bind(transactionController)
);

// Get monthly summary (must be before /:id)
router.get(
  '/monthly/:year/:month',
  authenticateUserOrApiToken,
  monthlySummaryValidation,
  validate,
  transactionController.getMonthlySummary.bind(transactionController)
);

// Get budget balance breakdown (must be before /:id)
router.get(
  '/budget/:budgetId/balance',
  authenticateUserOrApiToken,
  budgetBalanceValidation,
  validate,
  transactionController.getBudgetBalance.bind(transactionController)
);

// Get all transactions (with optional filters & pagination)
router.get(
  '/',
  authenticateUserOrApiToken,
  transactionQueryValidation,
  validate,
  transactionController.getAllTransactions.bind(transactionController)
);

// Get transaction by ID
router.get(
  '/:id',
  authenticateUserOrApiToken,
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
 *                     unmatchedCategories:
 *                       type: array
 *                       description: Transaction categories with no matching row in the Expenses sheet. Show them in the review step.
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
 *                     updatedCount:
 *                       type: object
 *                       description: Items that already existed in the budget (same name) and were updated in place.
 *                       properties:
 *                         incomeItems: { type: integer }
 *                         expenseItems: { type: integer }
 *                     skippedCount:
 *                       type: object
 *                       description: Rows not created because an identical row was already imported.
 *                       properties:
 *                         transactions: { type: integer }
 *                     unmatchedCategories:
 *                       type: array
 *                       description: Categories that matched no expense item; their rows were created without expenseItemId.
 *                       items: { type: string }
 *                     transactionIds:
 *                       type: array
 *                       description: Transactions created by this call (skipped rows excluded).
 *                       items: { type: string, format: uuid }
 *       400:
 *         description: Validation failed, or a referenced account does not exist / belong to the user (INVALID_ACCOUNT_REFERENCE)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       404:
 *         description: Budget not found (or belongs to another user)
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

/**
 * Screenshot import. Unlike the Excel import these two routes accept personal
 * API tokens (write scope): the client is Claude reading bank screenshots
 * through the finances MCP server. Deliberate exception to "imports are
 * session-only" — reviewed in src/tests/apiTokens/routeExposure.test.ts.
 *
 * @openapi
 * /api/transactions/import/screenshots/check:
 *   post:
 *     tags: [Transactions]
 *     summary: Which screenshot hashes were already imported
 *     description: Lets the client skip OCR for images it has sent before.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sha256s]
 *             properties:
 *               sha256s:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 50
 *                 items: { type: string, pattern: '^[a-fA-F0-9]{64}$' }
 *     responses:
 *       200:
 *         description: Hashes already imported (subset of the request, lowercase)
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
 *                     imported:
 *                       type: array
 *                       items: { type: string }
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 */
router.post(
  '/import/screenshots/check',
  authenticateUserOrApiToken,
  checkScreenshotsValidation,
  validate,
  screenshotImportController.check.bind(screenshotImportController)
);

/**
 * @openapi
 * /api/transactions/import/screenshots:
 *   post:
 *     tags: [Transactions]
 *     summary: Idempotent import of movements read from bank screenshots
 *     description: |
 *       Rows are grouped by the image they were read from. Re-importing the same
 *       screenshots, or overlapping ones, inserts nothing new; two identical
 *       purchases inside one screenshot stay two. An image whose SHA-256 was
 *       imported before is skipped whole. The year is inferred (screenshots
 *       don't show it), local time is America/Cancun, and each row's budget is
 *       derived from its date (`budgetId` stays null when that month has no
 *       budget). Atomic: all rows commit together with the account balance.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accountId, images]
 *             properties:
 *               accountId: { type: string, format: uuid }
 *               images:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 50
 *                 items:
 *                   type: object
 *                   required: [sha256, rows]
 *                   properties:
 *                     sha256: { type: string, pattern: '^[a-fA-F0-9]{64}$' }
 *                     rows:
 *                       type: array
 *                       maxItems: 100
 *                       items:
 *                         type: object
 *                         required: [day, month, time, rawDescriptor, amount, type]
 *                         properties:
 *                           day: { type: integer, minimum: 1, maximum: 31 }
 *                           month: { type: integer, minimum: 1, maximum: 12, description: 'January = 1' }
 *                           time: { type: string, example: '10:10', description: 'HH:mm, local time' }
 *                           rawDescriptor: { type: string, example: 'Stripe *unicef mx' }
 *                           amount: { type: number, example: 59 }
 *                           type: { type: string, enum: [income, expense] }
 *                           description: { type: string, description: 'Free-text note; never the category' }
 *     responses:
 *       201:
 *         description: Batch recorded (possibly with 0 inserted)
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
 *                     batchId: { type: string, format: uuid }
 *                     inserted: { type: integer }
 *                     skippedAsDuplicate: { type: integer }
 *                     skippedImages: { type: integer }
 *                     unbudgeted: { type: integer, description: 'Inserted rows whose month has no budget' }
 *                     transactionIds:
 *                       type: array
 *                       items: { type: string, format: uuid }
 *       400:
 *         description: Validation failed, invalid date (INVALID_SCREENSHOT_ROW) or account not owned (INVALID_ACCOUNT_REFERENCE)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403:
 *         description: API token without the write scope (INSUFFICIENT_SCOPE)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post(
  '/import/screenshots',
  authenticateUserOrApiToken,
  importScreenshotsValidation,
  validate,
  screenshotImportController.import.bind(screenshotImportController)
);

// Create new transaction
router.post(
  '/',
  authenticateUserOrApiToken,
  createTransactionValidation,
  validate,
  transactionController.createTransaction.bind(transactionController)
);

// Update transaction
router.put(
  '/:id',
  authenticateUserOrApiToken,
  updateTransactionValidation,
  validate,
  transactionController.updateTransaction.bind(transactionController)
);

// Delete transaction
router.delete(
  '/:id',
  authenticateUserOrApiToken,
  transactionIdValidation,
  validate,
  transactionController.deleteTransaction.bind(transactionController)
);

export { router as transactionRoutes };
