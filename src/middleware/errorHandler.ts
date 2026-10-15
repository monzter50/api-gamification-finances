import { type Request, type Response, type NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { logger } from '../config/logger';
import { AppError } from '../errors/AppError';

interface CustomError extends Error {
  statusCode?: number
  status?: number
  code?: string | number
  errorCode?: string
  /** Set by http-errors / body-parser when the message is safe to show. */
  expose?: boolean
  type?: string
}

/**
 * Standard error envelope:
 *
 *   { success: false, message, error, errorCode }
 *
 * `message` and `error` carry the same human-readable text — `message`
 * matches `ApiResponse`, `error` is kept for clients written against the
 * older shape. Branch on `errorCode` (stable) or the HTTP status, never on
 * the text.
 */
const sendError = (res: Response, statusCode: number, message: string, errorCode: string, extra: Record<string, unknown> = {}): void => {
  res.status(statusCode).json({ success: false, message, error: message, errorCode, ...extra });
};

/**
 * Global error handler — the ONE place that turns errors into HTTP responses.
 * Controllers and middleware forward errors with `next(error)`.
 *
 * Order of checks:
 *   1. Typed app errors (`AppError` subclasses) → their statusCode + errorCode
 *   2. Prisma errors → map known codes to HTTP statuses
 *   3. Body-parser / http-errors with `expose` (malformed JSON, payload too large)
 *   4. Everything else → 500, internals hidden outside development
 */
export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusHint = err instanceof AppError ? err.statusCode : (err.statusCode ?? err.status ?? 500);
  const logContext = {
    message: err.message,
    name: err.name,
    code: err.code,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: (req as Request & { user?: { userId?: string } }).user?.userId
  };
  if (statusHint >= 500) {
    logger.error('❌ Error:', { ...logContext, stack: err.stack });
  } else {
    logger.warn('⚠️  Request failed:', { ...logContext, statusCode: statusHint });
  }

  // 1. Typed application errors
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.message, err.errorCode);
    return;
  }

  // 2. Prisma errors (see https://www.prisma.io/docs/orm/reference/error-reference)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const { statusCode, message } = mapPrismaError(err);
    sendError(res, statusCode, message, err.code);
    return;
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    sendError(res, 400, 'Invalid query parameters', 'INVALID_QUERY');
    return;
  }

  // 3. Client errors raised by Express middleware (body-parser etc.)
  const isDev = process.env.NODE_ENV === 'development';
  if (statusHint >= 400 && statusHint < 500) {
    const message = err.expose === true ? err.message : 'Bad request';
    const errorCode = err.type === 'entity.too.large' ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST';
    sendError(res, statusHint, message, errorCode);
    return;
  }

  // 4. Fallback — never leak the original message or stack outside development
  sendError(
    res,
    500,
    isDev ? (err.message || 'Internal server error') : 'Internal server error',
    'INTERNAL_ERROR',
    isDev ? { stack: err.stack } : {}
  );
};

/**
 * Translate the most common Prisma error codes into HTTP statuses + safe messages.
 * Anything not listed falls through to a generic 400.
 */
function mapPrismaError (err: Prisma.PrismaClientKnownRequestError): { statusCode: number, message: string } {
  switch (err.code) {
    case 'P2002': // Unique constraint violation
      return { statusCode: 409, message: 'A record with this value already exists' };
    case 'P2003': // Foreign key constraint violation
      return { statusCode: 400, message: 'Referenced record does not exist' };
    case 'P2025': // Record not found (e.g. update/delete on missing row)
      return { statusCode: 404, message: 'Record not found' };
    case 'P2000': // Value too long for column
      return { statusCode: 400, message: 'Value exceeds column length' };
    default:
      return { statusCode: 400, message: 'Database request failed' };
  }
}
