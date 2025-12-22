import { body, param, query } from 'express-validator';
import { INCOME_TYPES, EXPENSE_TYPES } from '../models/Budget';

/**
 * Validation schemas for budget endpoints
 */

/**
 * Validation for creating a budget
 */
export const createBudgetValidation = [
  body('year')
    .isInt({ min: 2000, max: 2100 })
    .withMessage('Year must be between 2000 and 2100'),
  body('month')
    .isInt({ min: 0, max: 11 })
    .withMessage('Month must be between 0 and 11'),
  body('incomeItems')
    .optional()
    .isArray()
    .withMessage('Income items must be an array'),
  body('incomeItems.*.description')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Income item description is required'),
  body('incomeItems.*.amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Income item amount must be a positive number'),
  body('incomeItems.*.type')
    .optional()
    .isIn(INCOME_TYPES)
    .withMessage('Invalid income type. Must be one of: Debit Card, Credit Card, Cash, Vales, Transfer, Check, Other'),
  body('expenseItems')
    .optional()
    .isArray()
    .withMessage('Expense items must be an array'),
  body('expenseItems.*.description')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Expense item description is required'),
  body('expenseItems.*.amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Expense item amount must be a positive number'),
  body('expenseItems.*.type')
    .optional()
    .isIn(EXPENSE_TYPES)
    .withMessage('Invalid expense type. Must be one of: Fixed, Variable')
];

/**
 * Validation for updating a budget
 */
export const updateBudgetValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid budget ID'),
  body('year')
    .optional()
    .isInt({ min: 2000, max: 2100 })
    .withMessage('Year must be between 2000 and 2100'),
  body('month')
    .optional()
    .isInt({ min: 0, max: 11 })
    .withMessage('Month must be between 0 and 11'),
  body('incomeItems')
    .optional()
    .isArray()
    .withMessage('Income items must be an array'),
  body('incomeItems.*.description')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Income item description is required'),
  body('incomeItems.*.amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Income item amount must be a positive number'),
  body('incomeItems.*.type')
    .optional()
    .isIn(INCOME_TYPES)
    .withMessage('Invalid income type. Must be one of: Debit Card, Credit Card, Cash, Vales, Transfer, Check, Other'),
  body('expenseItems')
    .optional()
    .isArray()
    .withMessage('Expense items must be an array'),
  body('expenseItems.*.description')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Expense item description is required'),
  body('expenseItems.*.amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Expense item amount must be a positive number'),
  body('expenseItems.*.type')
    .optional()
    .isIn(EXPENSE_TYPES)
    .withMessage('Invalid expense type. Must be one of: Fixed, Variable')
];

/**
 * Validation for updating income items
 */
export const updateIncomeItemsValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid budget ID'),
  body('incomeItems')
    .isArray({ min: 0 })
    .withMessage('Income items must be an array'),
  body('incomeItems.*.description')
    .trim()
    .notEmpty()
    .withMessage('Income item description is required'),
  body('incomeItems.*.amount')
    .isFloat({ min: 0 })
    .withMessage('Income item amount must be a positive number'),
  body('incomeItems.*.type')
    .isIn(INCOME_TYPES)
    .withMessage('Invalid income type. Must be one of: Debit Card, Credit Card, Cash, Vales, Transfer, Check, Other')
];

/**
 * Validation for updating expense items
 */
export const updateExpenseItemsValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid budget ID'),
  body('expenseItems')
    .isArray({ min: 0 })
    .withMessage('Expense items must be an array'),
  body('expenseItems.*.description')
    .trim()
    .notEmpty()
    .withMessage('Expense item description is required'),
  body('expenseItems.*.amount')
    .isFloat({ min: 0 })
    .withMessage('Expense item amount must be a positive number'),
  body('expenseItems.*.type')
    .isIn(EXPENSE_TYPES)
    .withMessage('Invalid expense type. Must be one of: Fixed, Variable')
];

/**
 * Validation for budget ID parameter
 */
export const budgetIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid budget ID')
];

/**
 * Validation for item ID parameter (deprecated - use specific validators)
 */
export const itemIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid budget ID'),
  param('itemId')
    .isMongoId()
    .withMessage('Invalid item ID')
];

/**
 * Validation for income ID parameter (DELETE)
 */
export const deleteIncomeItemValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid budget ID'),
  param('incomeId')
    .isMongoId()
    .withMessage('Invalid income ID')
];

/**
 * Validation for expense ID parameter (DELETE)
 */
export const deleteExpenseItemValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid budget ID'),
  param('expenseId')
    .isMongoId()
    .withMessage('Invalid expense ID')
];

/**
 * Validation for query parameters
 */
export const budgetQueryValidation = [
  query('year')
    .optional()
    .isInt({ min: 2000, max: 2100 })
    .withMessage('Year must be between 2000 and 2100'),
  query('month')
    .optional()
    .isInt({ min: 0, max: 11 })
    .withMessage('Month must be between 0 and 11')
];

/**
 * Validation for adding a single income item
 */
export const addIncomeItemValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid budget ID'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required'),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  body('type')
    .isIn(INCOME_TYPES)
    .withMessage('Invalid income type. Must be one of: Debit Card, Credit Card, Cash, Vales, Transfer, Check, Other')
];

/**
 * Validation for adding a single expense item
 */
export const addExpenseItemValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid budget ID'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required'),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  body('type')
    .isIn(EXPENSE_TYPES)
    .withMessage('Invalid expense type. Must be one of: Fixed, Variable')
];

/**
 * Validation for updating a single income item
 */
export const updateIncomeItemValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid budget ID'),
  param('incomeId')
    .isMongoId()
    .withMessage('Invalid income ID'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required'),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  body('type')
    .isIn(INCOME_TYPES)
    .withMessage('Invalid income type. Must be one of: Debit Card, Credit Card, Cash, Vales, Transfer, Check, Other')
];

/**
 * Validation for updating a single expense item
 */
export const updateExpenseItemValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid budget ID'),
  param('expenseId')
    .isMongoId()
    .withMessage('Invalid expense ID'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required'),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  body('type')
    .isIn(EXPENSE_TYPES)
    .withMessage('Invalid expense type. Must be one of: Fixed, Variable')
];
