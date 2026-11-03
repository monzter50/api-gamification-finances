import { body } from 'express-validator';

export const updateProfileValidation = [
  // Stored raw; output encoding is the client's job.
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
];
