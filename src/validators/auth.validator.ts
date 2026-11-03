import { body } from 'express-validator';

/**
 * Validation schemas for authentication endpoints
 */

/** NIST SP 800-63B minimum for user-chosen passwords. */
export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt silently ignores everything past 72 bytes — reject instead of truncating. */
export const PASSWORD_MAX_BYTES = 72;

export const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .trim(),
  // Passwords are stored exactly as typed: no trim, no escaping.
  body('password')
    .isString()
    .withMessage('Password must be a string')
    .isLength({ min: PASSWORD_MIN_LENGTH })
    .withMessage(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`)
    .custom((value: string) => Buffer.byteLength(value, 'utf8') <= PASSWORD_MAX_BYTES)
    .withMessage(`Password must be at most ${PASSWORD_MAX_BYTES} bytes long`),
  // Stored raw; output encoding is the client's job (escaping here would
  // persist HTML entities like &amp; into the user's name).
  body('name')
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
];

export const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .trim(),
  // Not trimmed: AuthService.login compares the raw value first and falls
  // back to the trimmed one for passwords created under the old rule.
  body('password')
    .isString()
    .notEmpty()
    .withMessage('Password is required')
    .custom((value: string) => Buffer.byteLength(value, 'utf8') <= PASSWORD_MAX_BYTES)
    .withMessage('Invalid email or password')
];
