import { body } from 'express-validator';

/** Max rows accepted in one import (bounds the size of the atomic $transaction). */
export const IMPORT_BATCH_MAX = 200;

/**
 * Validation for confirming a reviewed statement import.
 * (The /extract endpoint takes multipart and is validated by multer, not here.)
 *
 * `budgetId` is batch-level; each row may override `accountId`. Per-row fields
 * mirror the single-create contract minus `budgetId`.
 */
export const confirmImportValidation = [
  body('budgetId')
    .isUUID()
    .withMessage('Budget ID must be a valid UUID'),
  body('accountId')
    .trim()
    .notEmpty()
    .withMessage('Account ID is required'),
  body('transactions')
    .isArray({ min: 1, max: IMPORT_BATCH_MAX })
    .withMessage(`transactions must be an array of 1 to ${IMPORT_BATCH_MAX} rows`),
  body('transactions.*.date')
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date'),
  body('transactions.*.amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('transactions.*.vendor')
    .trim()
    .notEmpty()
    .withMessage('Vendor is required'),
  body('transactions.*.type')
    .isIn(['income', 'expense'])
    .withMessage('Type must be either income or expense'),
  body('transactions.*.description')
    .optional()
    .trim(),
  body('transactions.*.accountId')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Account ID override cannot be empty'),
  body('transactions.*.incomeItemId')
    .optional()
    .isUUID()
    .withMessage('Income item ID must be a valid UUID'),
  body('transactions.*.expenseItemId')
    .optional()
    .isUUID()
    .withMessage('Expense item ID must be a valid UUID'),
  body('transactions.*.installmentCurrent')
    .optional()
    .isInt({ min: 1 })
    .withMessage('installmentCurrent must be a positive integer'),
  body('transactions.*.installmentTotal')
    .optional()
    .isInt({ min: 1 })
    .withMessage('installmentTotal must be a positive integer'),
  body('transactions.*.installmentOriginal')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('installmentOriginal must be a positive number')
];
