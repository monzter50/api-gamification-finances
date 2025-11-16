import { body } from 'express-validator';

/**
 * Validation schemas for user endpoints
 */

export const updateProfileValidation = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .trim()
    .escape(),
  body('savingsGoal')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Savings goal must be a positive number')
];

export const addExperienceValidation = [
  body('amount')
    .isInt({ min: 1 })
    .withMessage('Experience amount must be a positive integer')
];

export const spendCoinsValidation = [
  body('amount')
    .isInt({ min: 1 })
    .withMessage('Coin amount must be a positive integer'),
  body('description')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Description cannot exceed 200 characters')
    .trim()
];
