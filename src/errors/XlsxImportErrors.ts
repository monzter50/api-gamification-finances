import { AuthError } from './AuthErrors';

/**
 * Excel-import errors. Extend the generic `AuthError` base (statusCode +
 * errorCode) so the global errorHandler maps them automatically.
 */

export class NoFileUploadedError extends AuthError {
  constructor (message: string = 'No file uploaded') {
    super(message, 400, 'NO_FILE_UPLOADED');
  }
}

export class UnsupportedFileTypeError extends AuthError {
  constructor (message: string = 'Unsupported file type. Upload an .xlsx Excel file.') {
    super(message, 415, 'UNSUPPORTED_FILE_TYPE');
  }
}

export class FileTooLargeError extends AuthError {
  constructor (message: string = 'File is too large.') {
    super(message, 413, 'FILE_TOO_LARGE');
  }
}

/** The workbook parsed but yielded no importable rows. */
export class NoTransactionsFoundError extends AuthError {
  constructor (message: string = 'No transactions were found in the workbook.') {
    super(message, 422, 'NO_TRANSACTIONS_FOUND');
  }
}

/** A row's payment source has no account mapped at confirm time. */
export class UnmappedPaymentSourceError extends AuthError {
  constructor (message: string = 'A payment source is not mapped to an account.') {
    super(message, 400, 'UNMAPPED_PAYMENT_SOURCE');
  }
}
