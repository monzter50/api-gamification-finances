import { body } from 'express-validator';
import { INCOME_TYPES, EXPENSE_TYPES } from '../constants/budget.constants';

/** Max rows accepted in one import (bounds the atomic $transaction). */
export const XLSX_IMPORT_BATCH_MAX = 500;

/**
 * Validation for confirming an Excel import.
 * Creates budget income/expense items + transactions, so all three lists are
 * validated. (The /parse endpoint takes multipart and is validated by multer.)
 */
export const confirmXlsxValidation = [
  body('budgetId')
    .isUUID()
    .withMessage('Budget ID must be a valid UUID'),
  body('defaultAccountId')
    .trim()
    .notEmpty()
    .withMessage('A default account is required'),
  body('accountMapping')
    .optional()
    .isObject()
    .withMessage('accountMapping must be an object of paymentSource → accountId'),

  // At least one of the three lists must be present; cap each.
  body('transactions').isArray({ max: XLSX_IMPORT_BATCH_MAX }),
  body('incomeItems').isArray({ max: XLSX_IMPORT_BATCH_MAX }),
  body('expenseItems').isArray({ max: XLSX_IMPORT_BATCH_MAX }),

  // Transactions
  body('transactions.*.date').isISO8601().withMessage('Date must be a valid ISO 8601 date'),
  body('transactions.*.amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
  body('transactions.*.vendor').trim().notEmpty().withMessage('Vendor is required'),
  body('transactions.*.type').isIn(['income', 'expense']).withMessage('Type must be income or expense'),
  body('transactions.*.description').optional().trim(),
  body('transactions.*.paymentSource').optional().trim(),

  // Income items
  body('incomeItems.*.description').trim().notEmpty().withMessage('Income item description is required'),
  body('incomeItems.*.amount').isFloat({ min: 0 }).withMessage('Income item amount must be a positive number'),
  body('incomeItems.*.type').isIn(INCOME_TYPES).withMessage('Invalid income type'),
  body('incomeItems.*.accountId').isUUID().withMessage('Income item accountId must be a valid UUID'),

  // Expense items
  body('expenseItems.*.description').trim().notEmpty().withMessage('Expense item description is required'),
  body('expenseItems.*.amount').isFloat({ min: 0 }).withMessage('Expense item amount must be a positive number'),
  body('expenseItems.*.type').isIn(EXPENSE_TYPES).withMessage('Invalid expense type. Must be Fixed or Variable')
];
