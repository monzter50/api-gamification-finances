import { AuthError } from './AuthErrors';

/**
 * Statement-import errors.
 *
 * They extend the generic `AuthError` base (which carries `statusCode` +
 * `errorCode`), so the global `errorHandler` maps them to the right HTTP
 * response with no per-controller branching. (Despite its filename, `AuthError`
 * is the project's generic typed-error base — see CLAUDE.md.)
 */

/** No file was present on a multipart upload. */
export class NoFileUploadedError extends AuthError {
  constructor (message: string = 'No file uploaded') {
    super(message, 400, 'NO_FILE_UPLOADED');
  }
}

/** Uploaded file's mime type is not in the allowlist. */
export class UnsupportedFileTypeError extends AuthError {
  constructor (message: string = 'Unsupported file type. Upload a JPEG, PNG, or WebP image.') {
    super(message, 415, 'UNSUPPORTED_FILE_TYPE');
  }
}

/** Uploaded file exceeds the configured size limit. */
export class FileTooLargeError extends AuthError {
  constructor (message: string = 'File is too large.') {
    super(message, 413, 'FILE_TOO_LARGE');
  }
}

/** The extractor ran but found no transactions in the image. */
export class NoTransactionsFoundError extends AuthError {
  constructor (message: string = 'No transactions were found in the uploaded image.') {
    super(message, 422, 'NO_TRANSACTIONS_FOUND');
  }
}

/** The extractor failed (e.g. the AI call errored or returned an unusable result). */
export class ExtractionFailedError extends AuthError {
  constructor (message: string = 'Could not process the uploaded image. Please try again.') {
    super(message, 502, 'EXTRACTION_FAILED');
  }
}

/**
 * The Claude extractor was selected but cannot run (no API key / not yet
 * implemented). Fails loud so a misconfigured environment is obvious rather
 * than silently returning nothing.
 */
export class ExtractionUnavailableError extends AuthError {
  constructor (message: string = 'Transaction extraction service is not available.') {
    super(message, 503, 'EXTRACTION_UNAVAILABLE');
  }
}
