import { body } from 'express-validator';

/**
 * Validation for the screenshot parse endpoint.
 *
 * The images themselves are validated by the `imageUpload` middleware; these
 * chains cover the multipart text fields that travel alongside them.
 */
export const parseReceiptValidation = [
  body('accountKind')
    .optional()
    .isIn(['credit', 'debit'])
    .withMessage('accountKind must be either credit or debit'),
  body('referenceDate')
    .optional()
    .isISO8601()
    .withMessage('referenceDate must be an ISO-8601 date')
];
