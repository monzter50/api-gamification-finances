/**
 * Port: everything the export feature needs from Google, in our own terms.
 *
 * The service depends only on this interface; `adapters/google.adapter.ts`
 * implements it with google-auth-library + @googleapis/sheets. Tests use a
 * fake. No Google SDK types leak past this boundary.
 *
 * Adapters must translate failures into the typed errors in
 * `errors/GoogleErrors.ts` (reauth required / sheet not accessible /
 * unavailable) so the service and the errorHandler stay vendor-neutral.
 */

/** A cell is a literal: strings are never interpreted as formulas. */
export type SheetCell = string | number | null;
export type SheetRow = SheetCell[];

export interface SheetTable {
  header: string[]
  rows: SheetRow[]
  /** 0-based column indexes holding Sheets date serial numbers. */
  dateColumns: number[]
  /** 0-based column indexes holding money amounts. */
  moneyColumns: number[]
}

export interface GoogleGrant {
  refreshToken: string
  /** Space-separated scopes actually granted (users can untick some). */
  scope: string
  email: string | null
}

export interface SpreadsheetRef {
  spreadsheetId: string
  spreadsheetUrl: string
}

export interface GoogleGateway {
  /** Consent-screen URL for the given signed state. */
  buildConsentUrl: (state: string) => string
  /** Exchange the callback `code` for a long-lived grant. */
  exchangeCode: (code: string) => Promise<GoogleGrant>
  /** Revoke the grant at Google (best effort). */
  revoke: (refreshToken: string) => Promise<void>
  /** Create a new spreadsheet in the user's Drive with one tab. */
  createSpreadsheet: (refreshToken: string, title: string, tabName: string) => Promise<SpreadsheetRef>
  /** Replace the contents of `tabName` (created if missing). Other tabs are never touched. */
  replaceTab: (refreshToken: string, spreadsheetId: string, tabName: string, table: SheetTable) => Promise<SpreadsheetRef>
}
