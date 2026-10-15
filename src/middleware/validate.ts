import { type Request, type Response, type NextFunction } from 'express';
import { validationResult } from 'express-validator';

/**
 * Run after express-validator chains. On failure responds 400 with the
 * standard error envelope plus a per-field `errors` list:
 *
 *   { success: false, message, error, errorCode: 'VALIDATION_ERROR',
 *     errors: [{ field, message }] }
 *
 * Controllers behind this middleware must NOT call `validationResult` again.
 */
export const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const extractedErrors = errors.array().map(err => ({
      field: err.type === 'field' ? err.path : undefined,
      message: err.msg
    }));

    res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: 'Validation failed',
      errorCode: 'VALIDATION_ERROR',
      errors: extractedErrors
    });
    return;
  }

  next();
};
