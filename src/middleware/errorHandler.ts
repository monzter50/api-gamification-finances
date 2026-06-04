import { type Request, type Response, type NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { logger } from '../config/logger';
import { AuthError } from '../errors/AuthErrors';

interface CustomError extends Error {
  statusCode?: number
  code?: string | number
  errorCode?: string
}

/**
 * Global error handler.
 *
 * Most errors should already be caught + mapped inside controllers using
 * typed errors like `AuthError`. This handler is the last-resort safety net:
 * it normalizes anything that escapes a controller into a consistent JSON
 * envelope and logs context for debugging.
 *
 * Order of checks:
 *   1. Typed app errors (`AuthError` subclasses) → respect their statusCode
 *   2. Prisma errors → map known codes to HTTP statuses
 *   3. JWT errors → 401
 *   4. Everything else → 500 (generic, hides internals from clients)
 */
export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error('❌ Error:', {
    message: err.message,
    name: err.name,
    code: err.code,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // 1. Typed application errors
  if (err instanceof AuthError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      errorCode: err.errorCode
    });
    return;
  }

  // 2. Prisma known request errors (see https://www.prisma.io/docs/orm/reference/error-reference)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const { statusCode, message } = mapPrismaError(err);
    res.status(statusCode).json({
      success: false,
      error: message,
      errorCode: err.code
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      success: false,
      error: 'Invalid query parameters'
    });
    return;
  }

  // 3. JWT errors (thrown by jsonwebtoken's verify)
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({ success: false, error: 'Token inválido' });
    return;
  }
  if (err.name === 'TokenExpiredError') {
    res.status(401).json({ success: false, error: 'Token expirado' });
    return;
  }

  // 4. Fallback — never leak the original message in production
  const isDev = process.env.NODE_ENV === 'development';
  res.status(err.statusCode ?? 500).json({
    success: false,
    error: isDev ? (err.message || 'Internal server error') : 'Internal server error',
    ...(isDev && { stack: err.stack })
  });
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
