/**
 * Base class for every expected (non-bug) application error.
 *
 * Carries the HTTP `statusCode` and a stable machine-readable `errorCode`.
 * Services throw subclasses; controllers forward them with `next(error)` and
 * the global `errorHandler` turns them into the JSON error envelope.
 *
 * `errorCode` is part of the API contract — never rename an existing one.
 */
export class AppError extends Error {
  constructor (
    message: string,
    public statusCode: number,
    public errorCode: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
