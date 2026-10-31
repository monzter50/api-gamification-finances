import { AppError } from './AppError';

/** A screenshot row that passed shape validation but isn't a real movement (e.g. 31 de febrero). */
export class InvalidScreenshotRowError extends AppError {
  constructor (message: string) {
    super(message, 400, 'INVALID_SCREENSHOT_ROW');
  }
}
