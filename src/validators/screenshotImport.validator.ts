import { body } from 'express-validator';

/** Bounds the atomic $transaction: a batch is one scroll session of screenshots. */
export const SCREENSHOT_IMPORT_MAX_IMAGES = 50;
export const SCREENSHOT_IMPORT_MAX_ROWS_PER_IMAGE = 100;

const sha256Rule = (field: string) => body(field)
  .isHash('sha256')
  .withMessage('Each image hash must be a hex SHA-256');

/** POST /transactions/import/screenshots/check */
export const checkScreenshotsValidation = [
  body('sha256s')
    .isArray({ min: 1, max: SCREENSHOT_IMPORT_MAX_IMAGES })
    .withMessage(`sha256s must be an array of 1-${SCREENSHOT_IMPORT_MAX_IMAGES} hashes`),
  sha256Rule('sha256s.*')
];

/** POST /transactions/import/screenshots */
export const importScreenshotsValidation = [
  body('accountId')
    .isUUID()
    .withMessage('Account ID must be a valid UUID'),
  body('images')
    .isArray({ min: 1, max: SCREENSHOT_IMPORT_MAX_IMAGES })
    .withMessage(`images must be an array of 1-${SCREENSHOT_IMPORT_MAX_IMAGES} items`),
  sha256Rule('images.*.sha256'),
  body('images.*.rows')
    .isArray({ max: SCREENSHOT_IMPORT_MAX_ROWS_PER_IMAGE })
    .withMessage(`rows must be an array of at most ${SCREENSHOT_IMPORT_MAX_ROWS_PER_IMAGE} items`),
  body('images.*.rows.*.day')
    .isInt({ min: 1, max: 31 })
    .withMessage('day must be between 1 and 31')
    .toInt(),
  body('images.*.rows.*.month')
    .isInt({ min: 1, max: 12 })
    .withMessage('month must be between 1 and 12 (January = 1)')
    .toInt(),
  body('images.*.rows.*.time')
    .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage('time must be HH:mm (24h, local time)'),
  body('images.*.rows.*.rawDescriptor')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('rawDescriptor is required')
    .isLength({ max: 200 })
    .withMessage('rawDescriptor must not exceed 200 characters'),
  body('images.*.rows.*.amount')
    .isFloat({ min: 0.01 })
    .withMessage('amount must be a positive number')
    .toFloat(),
  body('images.*.rows.*.type')
    .isIn(['income', 'expense'])
    .withMessage('type must be income or expense'),
  body('images.*.rows.*.description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('description must not exceed 500 characters')
];
