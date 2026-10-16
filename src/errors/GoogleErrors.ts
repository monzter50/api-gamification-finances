import { AppError } from './AppError';

/**
 * Google Sheets export errors.
 *
 * None of these use 401: the SPA treats any 401 as "your app session is
 * invalid" and logs the user out. A broken *Google* link is not that — the
 * user is still signed in to our app and just needs to reconnect Google.
 */

/** The server has no Google OAuth credentials configured. */
export class GoogleNotConfiguredError extends AppError {
  constructor (message: string = 'Google integration is not configured on this server') {
    super(message, 503, 'GOOGLE_NOT_CONFIGURED');
  }
}

/** The user hasn't connected a Google account yet. */
export class GoogleNotConnectedError extends AppError {
  constructor (message: string = 'Connect your Google account first') {
    super(message, 409, 'GOOGLE_NOT_CONNECTED');
  }
}

/** Google rejected our stored grant (revoked, expired, password change...). Reconnect. */
export class GoogleReauthRequiredError extends AppError {
  constructor (message: string = 'Google access was revoked or expired. Please reconnect your Google account.') {
    super(message, 409, 'GOOGLE_REAUTH_REQUIRED');
  }
}

/** The stored spreadsheet no longer exists or isn't accessible to the app. */
export class SheetNotAccessibleError extends AppError {
  constructor (message: string = 'The Google spreadsheet is no longer accessible') {
    super(message, 404, 'SHEET_NOT_ACCESSIBLE');
  }
}

/** Google is down, rate-limiting us, or timed out. Safe to retry later. */
export class GoogleUnavailableError extends AppError {
  constructor (message: string = 'Google is temporarily unavailable. Please try again later.') {
    super(message, 503, 'GOOGLE_UNAVAILABLE');
  }
}

/** Too many rows to export in one go. */
export class ExportTooLargeError extends AppError {
  constructor (maxRows: number) {
    super(`Too many transactions to export at once (max ${maxRows}). Narrow the date range.`, 422, 'EXPORT_TOO_LARGE');
  }
}
