import { OAuth2Client } from 'google-auth-library';
import { sheets, type sheets_v4 as SheetsV4 } from '@googleapis/sheets';
import { type GoogleOAuthConfig } from '../../../config/env';
import {
  GoogleReauthRequiredError,
  GoogleUnavailableError,
  SheetNotAccessibleError
} from '../../../errors/GoogleErrors';
import {
  type GoogleGateway,
  type GoogleGrant,
  type SheetTable,
  type SpreadsheetRef
} from '../googleGateway.port';

/**
 * Least privilege:
 *  - drive.file: only files this app creates (or the user explicitly opens
 *    with it). Not a "sensitive" scope — no Google verification needed, and
 *    a leaked token can't read the rest of the user's Drive.
 *  - openid + email: to show which Google account is connected.
 */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'email'
];
export const REQUIRED_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/** Every Google call gets a deadline so a slow Google can't pin our workers. */
const REQUEST_TIMEOUT_MS = 20_000;

interface GoogleLikeError {
  status?: number
  code?: string | number
  name?: string
  message?: string
  response?: { status?: number, data?: unknown }
}

const NETWORK_CODES = new Set(['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNABORTED']);

/**
 * Translate a Google/gaxios failure into our typed errors. Pure, exported for tests.
 * `onSpreadsheet` = the call targeted a specific spreadsheet (404/403 then
 * means that file is gone or out of reach, not that our grant is bad).
 */
export function mapGoogleError (err: unknown, onSpreadsheet: boolean): Error {
  const e = (err ?? {}) as GoogleLikeError;
  const status = e.status ?? e.response?.status ?? (typeof e.code === 'number' ? e.code : undefined);
  const data = JSON.stringify(e.response?.data ?? '');
  const text = `${e.message ?? ''} ${data}`;

  if (text.includes('invalid_grant') || status === 401) {
    return new GoogleReauthRequiredError();
  }
  if (status === 403 && /insufficient(Permissions| authentication scopes)|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(text)) {
    return new GoogleReauthRequiredError('Google access is missing a required permission. Please reconnect your Google account.');
  }
  if (onSpreadsheet && (status === 404 || status === 403)) {
    return new SheetNotAccessibleError();
  }
  if (status === 429 || (status !== undefined && status >= 500) ||
      (typeof e.code === 'string' && NETWORK_CODES.has(e.code)) ||
      e.name === 'AbortError' || e.name === 'TimeoutError') {
    return new GoogleUnavailableError();
  }
  return err instanceof Error ? err : new Error('Unexpected Google API error');
}

/** Quote a tab name for A1 notation: 'My Tab'!A1 (single quotes doubled). */
const a1Tab = (tabName: string): string => `'${tabName.replace(/'/g, "''")}'`;

export class GoogleAdapter implements GoogleGateway {
  constructor (private readonly config: GoogleOAuthConfig) {}

  private oauthClient (refreshToken?: string): OAuth2Client {
    const client = new OAuth2Client({
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      redirectUri: this.config.redirectUri
    });
    if (refreshToken !== undefined) client.setCredentials({ refresh_token: refreshToken });
    return client;
  }

  private sheetsApi (refreshToken: string): SheetsV4.Sheets {
    return sheets({ version: 'v4', auth: this.oauthClient(refreshToken) });
  }

  buildConsentUrl (state: string): string {
    return this.oauthClient().generateAuthUrl({
      access_type: 'offline', // we need a refresh token for on-demand syncs
      prompt: 'consent', // always return a refresh token, even on re-connect
      scope: GOOGLE_SCOPES,
      include_granted_scopes: false,
      state
    });
  }

  async exchangeCode (code: string): Promise<GoogleGrant> {
    const client = this.oauthClient();
    try {
      const { tokens } = await client.getToken(code);
      if (tokens.refresh_token == null) {
        throw new GoogleReauthRequiredError('Google did not return a refresh token. Please try connecting again.');
      }
      let email: string | null = null;
      if (tokens.id_token != null) {
        const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: this.config.clientId });
        email = ticket.getPayload()?.email ?? null;
      }
      return { refreshToken: tokens.refresh_token, scope: tokens.scope ?? '', email };
    } catch (err) {
      if (err instanceof GoogleReauthRequiredError) throw err;
      throw mapGoogleError(err, false);
    }
  }

  async revoke (refreshToken: string): Promise<void> {
    try {
      await this.oauthClient().revokeToken(refreshToken);
    } catch (err) {
      throw mapGoogleError(err, false);
    }
  }

  async createSpreadsheet (refreshToken: string, title: string, tabName: string): Promise<SpreadsheetRef> {
    try {
      const res = await this.sheetsApi(refreshToken).spreadsheets.create({
        requestBody: {
          properties: { title },
          sheets: [{ properties: { title: tabName, gridProperties: { frozenRowCount: 1 } } }]
        },
        fields: 'spreadsheetId,spreadsheetUrl'
      }, { timeout: REQUEST_TIMEOUT_MS });
      const { spreadsheetId, spreadsheetUrl } = res.data;
      if (spreadsheetId == null || spreadsheetUrl == null) {
        throw new GoogleUnavailableError('Google did not return the new spreadsheet');
      }
      return { spreadsheetId, spreadsheetUrl };
    } catch (err) {
      throw err instanceof GoogleUnavailableError ? err : mapGoogleError(err, false);
    }
  }

  async replaceTab (refreshToken: string, spreadsheetId: string, tabName: string, table: SheetTable): Promise<SpreadsheetRef> {
    const api = this.sheetsApi(refreshToken);
    try {
      // 1. Find (or create) our tab. Other tabs are never read or written.
      const meta = await api.spreadsheets.get({
        spreadsheetId,
        fields: 'spreadsheetUrl,sheets.properties(sheetId,title)'
      }, { timeout: REQUEST_TIMEOUT_MS });
      let sheetId = meta.data.sheets?.find((s) => s.properties?.title === tabName)?.properties?.sheetId ?? undefined;

      if (sheetId === undefined) {
        const added = await api.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: [{ addSheet: { properties: { title: tabName, gridProperties: { frozenRowCount: 1 } } } }] }
        }, { timeout: REQUEST_TIMEOUT_MS });
        sheetId = added.data.replies?.[0]?.addSheet?.properties?.sheetId ?? undefined;
      }

      // 2. Replace the values. RAW = stored exactly as sent: strings are
      //    literals (no formula execution), numbers stay numbers.
      await api.spreadsheets.values.clear({ spreadsheetId, range: a1Tab(tabName) }, { timeout: REQUEST_TIMEOUT_MS });
      await api.spreadsheets.values.update({
        spreadsheetId,
        range: `${a1Tab(tabName)}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [table.header, ...table.rows] }
      }, { timeout: REQUEST_TIMEOUT_MS });

      // 3. Format date and money columns (presentation only).
      if (sheetId !== undefined && table.rows.length > 0) {
        const columnFormat = (column: number, pattern: { type: string, pattern: string }): SheetsV4.Schema$Request => ({
          repeatCell: {
            range: { sheetId, startRowIndex: 1, endRowIndex: table.rows.length + 1, startColumnIndex: column, endColumnIndex: column + 1 },
            cell: { userEnteredFormat: { numberFormat: pattern } },
            fields: 'userEnteredFormat.numberFormat'
          }
        });
        await api.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              ...table.dateColumns.map((c) => columnFormat(c, { type: 'DATE', pattern: 'yyyy-mm-dd' })),
              ...table.moneyColumns.map((c) => columnFormat(c, { type: 'NUMBER', pattern: '#,##0.00' }))
            ]
          }
        }, { timeout: REQUEST_TIMEOUT_MS });
      }

      return { spreadsheetId, spreadsheetUrl: meta.data.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${spreadsheetId}` };
    } catch (err) {
      throw mapGoogleError(err, true);
    }
  }
}
