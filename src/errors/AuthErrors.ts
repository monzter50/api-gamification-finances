/**
 * Base class for authentication errors
 */
export class AuthError extends Error {
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

/**
 * Error thrown when user credentials are invalid
 */
export class InvalidCredentialsError extends AuthError {
  constructor (message: string = 'Invalid email or password') {
    super(message, 401, 'INVALID_CREDENTIALS');
  }
}

/**
 * Error thrown when user account is deactivated
 */
export class AccountDeactivatedError extends AuthError {
  constructor (message: string = 'Account is deactivated. Please contact support.') {
    super(message, 403, 'ACCOUNT_DEACTIVATED');
  }
}

/**
 * Error thrown when user is not found
 */
export class UserNotFoundError extends AuthError {
  constructor (message: string = 'User not found') {
    super(message, 404, 'USER_NOT_FOUND');
  }
}

/**
 * Error thrown when user already exists
 */
export class UserAlreadyExistsError extends AuthError {
  constructor (message: string = 'User with this email already exists') {
    super(message, 409, 'USER_ALREADY_EXISTS');
  }
}

/**
 * Error thrown when token is invalid or expired
 */
export class InvalidTokenError extends AuthError {
  constructor (message: string = 'Invalid or expired token') {
    super(message, 401, 'INVALID_TOKEN');
  }
}

/**
 * Error thrown when token has been blacklisted
 */
export class TokenBlacklistedError extends AuthError {
  constructor (message: string = 'Token has been invalidated') {
    super(message, 401, 'TOKEN_BLACKLISTED');
  }
}

/**
 * Error thrown when a token's session has been superseded by a newer login
 * (single-active-session enforcement). Uses a dedicated 440 status so the
 * frontend can recognize it through `@aglaya/api-core`, which only exposes the
 * HTTP status (not the JSON body) on a failed request.
 */
export class SessionRevokedError extends AuthError {
  constructor (message: string = 'Your session was ended because your account was used on another device.') {
    super(message, 440, 'SESSION_REVOKED');
  }
}

/**
 * Error thrown at login when the user already has an active session within the
 * inactivity window. The user must log out of the other session (or wait for it
 * to go idle) before signing in again.
 */
export class SessionAlreadyActiveError extends AuthError {
  constructor (message: string = 'You already have an active session on another device. Log out there or wait a few minutes, then try again.') {
    super(message, 409, 'SESSION_ALREADY_ACTIVE');
  }
}
