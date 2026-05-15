import { body, param } from 'express-validator';

const ACCOUNT_TYPES = ['checking', 'savings', 'credit_card', 'vales'];

export const createAccountValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Account name is required')
    .isLength({ max: 100 })
    .withMessage('Account name must not exceed 100 characters'),

  body('type')
    .notEmpty()
    .withMessage('Account type is required')
    .isIn(ACCOUNT_TYPES)
    .withMessage(`Account type must be one of: ${ACCOUNT_TYPES.join(', ')}`),

  body('balance')
    .optional()
    .isFloat()
    .withMessage('Balance must be a number'),

  body('currency')
    .optional()
    .trim()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be a 3-letter code (e.g. MXN, USD)'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

export const updateAccountValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Account name must not be empty')
    .isLength({ max: 100 })
    .withMessage('Account name must not exceed 100 characters'),

  body('type')
    .optional()
    .isIn(ACCOUNT_TYPES)
    .withMessage(`Account type must be one of: ${ACCOUNT_TYPES.join(', ')}`),

  body('balance')
    .optional()
    .isFloat()
    .withMessage('Balance must be a number'),

  body('currency')
    .optional()
    .trim()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be a 3-letter code (e.g. MXN, USD)'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

export const accountIdValidation = [
  param('id')
    .isUUID()
    .withMessage('Account ID must be a valid UUID')
];
