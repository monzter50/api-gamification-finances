import { AuthError } from './AuthErrors';

/**
 * Receipt/screenshot import errors.
 *
 * Extend the generic `AuthError` base (statusCode + errorCode) so the global
 * errorHandler maps them automatically — same pattern as XlsxImportErrors.
 */

/** The vision feature is switched off for this environment. */
export class VisionDisabledError extends AuthError {
  constructor (message: string = 'Image parsing is not enabled in this environment.') {
    super(message, 503, 'VISION_DISABLED');
  }
}

/** The model host refused the connection or returned a non-2xx. */
export class VisionUnavailableError extends AuthError {
  constructor (message: string = 'The vision model is unavailable. Try again shortly.') {
    super(message, 503, 'VISION_UNAVAILABLE');
  }
}

/**
 * The model host was reachable but did not answer within the configured
 * window. Kept distinct from `VisionUnavailableError` — "it's down" and
 * "it's just slow" call for different client behavior (retry immediately vs.
 * resubmit with fewer/smaller images).
 */
export class VisionTimeoutError extends AuthError {
  constructor (message: string = 'The vision model did not respond in time. Try again with fewer or smaller images.') {
    super(message, 504, 'VISION_TIMEOUT');
  }
}

/** The model answered, but not with JSON matching the expected schema. */
export class VisionOutputInvalidError extends AuthError {
  constructor (message: string = 'The vision model returned an unreadable response.') {
    super(message, 422, 'VISION_OUTPUT_INVALID');
  }
}

/** The image parsed fine but contained no transaction rows. */
export class NoRowsDetectedError extends AuthError {
  constructor (message: string = 'No transaction rows were detected in the image.') {
    super(message, 422, 'NO_ROWS_DETECTED');
  }
}
