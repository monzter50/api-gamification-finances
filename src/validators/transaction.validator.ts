import { body, param, query } from 'express-validator';

/**
 * Validation schemas for transaction endpoints
 */

/**
 * Validation for creating a transaction
 */
export const createTransactionValidation = [
    body('budgetId')
        .isUUID()
        .withMessage('Budget ID must be a valid UUID'),
    body('date')
        .isISO8601()
        .withMessage('Date must be a valid ISO 8601 date'),
    body('amount')
        .isFloat({ min: 0.01 })
        .withMessage('Amount must be a positive number'),
    body('vendor')
        .trim()
        .notEmpty()
        .withMessage('Vendor is required'),
    body('type')
        .isIn(['income', 'expense'])
        .withMessage('Type must be either income or expense'),
    body('accountId')
        .trim()
        .notEmpty()
        .withMessage('Account ID is required'),
    body('description')
        .optional()
        .trim(),
    body('incomeItemId')
        .optional()
        .isUUID()
        .withMessage('Income item ID must be a valid UUID'),
    body('expenseItemId')
        .optional()
        .isUUID()
        .withMessage('Expense item ID must be a valid UUID'),
    body('installmentCurrent')
        .optional()
        .isInt({ min: 1 })
        .withMessage('installmentCurrent must be a positive integer'),
    body('installmentTotal')
        .optional()
        .isInt({ min: 1 })
        .withMessage('installmentTotal must be a positive integer'),
    body('installmentOriginal')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('installmentOriginal must be a positive number')
];

/**
 * Validation for updating a transaction
 */
export const updateTransactionValidation = [
    param('id')
        .isUUID()
        .withMessage('Invalid transaction ID'),
    body('date')
        .optional()
        .isISO8601()
        .withMessage('Date must be a valid ISO 8601 date'),
    body('amount')
        .optional()
        .isFloat({ min: 0.01 })
        .withMessage('Amount must be a positive number'),
    body('vendor')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Vendor cannot be empty'),
    body('type')
        .optional()
        .isIn(['income', 'expense'])
        .withMessage('Type must be either income or expense'),
    body('accountId')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Account ID cannot be empty'),
    body('description')
        .optional()
        .trim(),
    body('incomeItemId')
        .optional({ values: 'null' })
        .isUUID()
        .withMessage('Income item ID must be a valid UUID'),
    body('expenseItemId')
        .optional({ values: 'null' })
        .isUUID()
        .withMessage('Expense item ID must be a valid UUID'),
    body('installmentCurrent')
        .optional()
        .isInt({ min: 1 })
        .withMessage('installmentCurrent must be a positive integer'),
    body('installmentTotal')
        .optional()
        .isInt({ min: 1 })
        .withMessage('installmentTotal must be a positive integer'),
    body('installmentOriginal')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('installmentOriginal must be a positive number')
];

/**
 * Validation for transaction ID parameter
 */
export const transactionIdValidation = [
    param('id')
        .isUUID()
        .withMessage('Invalid transaction ID')
];

/**
 * Validation for transaction query parameters
 */
export const transactionQueryValidation = [
    query('type')
        .optional()
        .isIn(['income', 'expense'])
        .withMessage('Type must be either income or expense'),
    query('budgetId')
        .optional()
        .isUUID()
        .withMessage('Budget ID must be a valid UUID'),
    query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be a valid ISO 8601 date'),
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
];

/**
 * Validation for monthly summary parameters
 */
export const monthlySummaryValidation = [
    param('year')
        .isInt({ min: 2000, max: 2100 })
        .withMessage('Year must be between 2000 and 2100'),
    param('month')
        .isInt({ min: 1, max: 12 })
        .withMessage('Month must be between 1 and 12')
];
