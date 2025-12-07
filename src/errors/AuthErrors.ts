/**
 * Base class for authentication errors
 */
export class AuthError extends Error {
  constructor(
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
  constructor(message: string = 'Invalid email or password') {
    super(message, 401, 'INVALID_CREDENTIALS');
  }
}

/**
 * Error thrown when user account is deactivated
 */
export class AccountDeactivatedError extends AuthError {
  constructor(message: string = 'Account is deactivated. Please contact support.') {
    super(message, 403, 'ACCOUNT_DEACTIVATED');
  }
}

/**
 * Error thrown when user is not found
 */
export class UserNotFoundError extends AuthError {
  constructor(message: string = 'User not found') {
    super(message, 404, 'USER_NOT_FOUND');
  }
}

/**
 * Error thrown when user already exists
 */
export class UserAlreadyExistsError extends AuthError {
  constructor(message: string = 'User with this email already exists') {
    super(message, 409, 'USER_ALREADY_EXISTS');
  }
}

/**
 * Error thrown when token is invalid or expired
 */
export class InvalidTokenError extends AuthError {
  constructor(message: string = 'Invalid or expired token') {
    super(message, 401, 'INVALID_TOKEN');
  }
}

/**
 * Error thrown when token has been blacklisted
 */
export class TokenBlacklistedError extends AuthError {
  constructor(message: string = 'Token has been invalidated') {
    super(message, 401, 'TOKEN_BLACKLISTED');
  }
}
