import { getGoogleOAuthConfig, getJwtSecret } from '../../config/env';
import { logger } from '../../config/logger';
import { googleIntegrationRepository } from '../../repositories/googleIntegration.repository';
import { transactionRepository } from '../../repositories/transaction.repository';
import { budgetRepository } from '../../repositories/budget.repository';
import { BudgetNotFoundError } from '../../errors/DomainErrors';
import {
  ExportTooLargeError,
  GoogleNotConfiguredError,
  GoogleNotConnectedError,
  GoogleReauthRequiredError,
  SheetNotAccessibleError
} from '../../errors/GoogleErrors';
import { decryptSecret, encryptSecret } from '../../utils/crypto';
import { createSignedState, verifySignedState } from '../../utils/signedState';
import { GoogleAdapter, REQUIRED_SCOPE } from './adapters/google.adapter';
import { type GoogleGateway, type SpreadsheetRef } from './googleGateway.port';
import { toSheetTable } from './sheetRows';

/** Purpose bound into the OAuth `state` HMAC (see utils/signedState). */
export const OAUTH_STATE_PURPOSE = 'google-sheets-connect';
const OAUTH_STATE_TTL_SECONDS = 10 * 60;

export const SPREADSHEET_TITLE = 'Finanzas – export';
/** The ONLY tab the app writes. The user's other tabs are never touched. */
export const EXPORT_TAB = 'Transacciones (app)';
export const MAX_EXPORT_ROWS = 20_000;

/** Where the browser lands after the OAuth callback (relative to FRONTEND_URL). */
const RETURN_PATH = '/settings/integrations';

export interface SyncFilters {
  from?: Date
  to?: Date
  budgetId?: string
}

export interface SyncResult {
  spreadsheetId: string
  spreadsheetUrl: string
  rowsWritten: number
  syncedAt: Date
  /** True when a new spreadsheet had to be created (first sync, or the old one was deleted). */
  createdSpreadsheet: boolean
}

export interface IntegrationStatus {
  configured: boolean
  connected: boolean
  googleEmail: string | null
  spreadsheetId: string | null
  spreadsheetUrl: string | null
  lastSyncAt: Date | null
}

type GatewayFactory = () => GoogleGateway | null;

const defaultGatewayFactory: GatewayFactory = () => {
  const config = getGoogleOAuthConfig();
  return config === null ? null : new GoogleAdapter(config);
};

const sheetUrl = (spreadsheetId: string): string => `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

export class GoogleSheetsExportService {
  constructor (private readonly gatewayFactory: GatewayFactory = defaultGatewayFactory) {}

  private gateway (): GoogleGateway {
    const gateway = this.gatewayFactory();
    if (gateway === null) throw new GoogleNotConfiguredError();
    return gateway;
  }

  /** Decrypt the stored grant; the userId is the AAD, so a row copied to another user fails here. */
  private async requireConnection (userId: string): Promise<{ refreshToken: string, spreadsheetId: string | null }> {
    const integration = await googleIntegrationRepository.findByUser(userId);
    if (integration === null) throw new GoogleNotConnectedError();
    try {
      return { refreshToken: decryptSecret(integration.refreshTokenEnc, userId), spreadsheetId: integration.spreadsheetId };
    } catch (err) {
      // Wrong/rotated TOKEN_ENCRYPTION_KEY or tampered row: the only recovery is reconnecting.
      logger.error(`Google token for user ${userId} could not be decrypted`, { name: (err as Error).name });
      throw new GoogleReauthRequiredError();
    }
  }

  // ---- OAuth -----------------------------------------------------------------

  /** Consent URL for the signed-in user. The state binds the callback to this user. */
  getConnectUrl (userId: string): string {
    const gateway = this.gateway();
    const state = createSignedState(userId, OAUTH_STATE_PURPOSE, getJwtSecret(), OAUTH_STATE_TTL_SECONDS);
    return gateway.buildConsentUrl(state);
  }

  /**
   * Handle Google's redirect. Never throws: it's a browser navigation, so
   * every outcome becomes a redirect to the fixed frontend URL with a short
   * reason code (no tokens, no internal messages in the URL).
   */
  async handleCallback (query: { code?: unknown, state?: unknown, error?: unknown }): Promise<string> {
    const config = getGoogleOAuthConfig();
    if (config === null) throw new GoogleNotConfiguredError();
    const back = (params: Record<string, string>): string =>
      `${config.frontendUrl}${RETURN_PATH}?${new URLSearchParams(params).toString()}`;

    if (typeof query.error === 'string') {
      return back({ google: 'error', reason: query.error === 'access_denied' ? 'access_denied' : 'google_error' });
    }
    if (typeof query.code !== 'string' || typeof query.state !== 'string') {
      return back({ google: 'error', reason: 'invalid_request' });
    }
    const userId = verifySignedState(query.state, OAUTH_STATE_PURPOSE, getJwtSecret());
    if (userId === null) {
      logger.warn('Google OAuth callback with invalid or expired state');
      return back({ google: 'error', reason: 'invalid_state' });
    }

    try {
      const grant = await this.gateway().exchangeCode(query.code);
      // Granular consent lets users untick Drive access; without it we can't export.
      if (!grant.scope.split(' ').includes(REQUIRED_SCOPE)) {
        await this.gateway().revoke(grant.refreshToken).catch(() => undefined);
        return back({ google: 'error', reason: 'missing_scope' });
      }
      await googleIntegrationRepository.upsertConnection(userId, {
        refreshTokenEnc: encryptSecret(grant.refreshToken, userId),
        scope: grant.scope,
        googleEmail: grant.email
      });
      logger.info(`Google account connected for user ${userId}`);
      return back({ google: 'connected' });
    } catch (err) {
      logger.warn(`Google OAuth callback failed for user ${userId}`, { name: (err as Error).name });
      return back({ google: 'error', reason: 'exchange_failed' });
    }
  }

  async getStatus (userId: string): Promise<IntegrationStatus> {
    const configured = getGoogleOAuthConfig() !== null;
    const integration = await googleIntegrationRepository.findByUser(userId);
    return {
      configured,
      connected: integration !== null,
      googleEmail: integration?.googleEmail ?? null,
      spreadsheetId: integration?.spreadsheetId ?? null,
      spreadsheetUrl: integration?.spreadsheetId != null ? sheetUrl(integration.spreadsheetId) : null,
      lastSyncAt: integration?.lastSyncAt ?? null
    };
  }

  /** Revoke at Google (best effort) and always delete our copy of the grant. */
  async disconnect (userId: string): Promise<void> {
    const integration = await googleIntegrationRepository.findByUser(userId);
    if (integration === null) return;
    try {
      const refreshToken = decryptSecret(integration.refreshTokenEnc, userId);
      const gateway = this.gatewayFactory();
      if (gateway !== null) await gateway.revoke(refreshToken);
    } catch (err) {
      // Already revoked, Google down, or undecryptable: still forget the token locally.
      logger.warn(`Google revoke failed for user ${userId}; deleting local grant anyway`, { name: (err as Error).name });
    }
    await googleIntegrationRepository.deleteByUser(userId);
    logger.info(`Google account disconnected for user ${userId}`);
  }

  // ---- Spreadsheet ---------------------------------------------------------------

  /** Create a fresh spreadsheet in the user's Drive and make it the export target. */
  async createSpreadsheet (userId: string): Promise<SpreadsheetRef> {
    const { refreshToken } = await this.requireConnection(userId);
    const ref = await this.gateway().createSpreadsheet(refreshToken, SPREADSHEET_TITLE, EXPORT_TAB);
    await googleIntegrationRepository.setSpreadsheet(userId, ref.spreadsheetId);
    logger.info(`Google spreadsheet created for user ${userId}`);
    return ref;
  }

  /**
   * Export the user's transactions to the app's tab. Creates the spreadsheet
   * on first use, and re-creates it if the user deleted the old one.
   */
  async sync (userId: string, filters: SyncFilters = {}): Promise<SyncResult> {
    const { refreshToken, spreadsheetId } = await this.requireConnection(userId);

    if (filters.budgetId !== undefined) {
      const budget = await budgetRepository.findByIdAndUser(filters.budgetId, userId);
      if (budget === null) throw new BudgetNotFoundError();
    }

    const transactions = await transactionRepository.findForExport(userId, filters, MAX_EXPORT_ROWS + 1);
    if (transactions.length > MAX_EXPORT_ROWS) throw new ExportTooLargeError(MAX_EXPORT_ROWS);
    const table = toSheetTable(transactions);

    const gateway = this.gateway();
    let createdSpreadsheet = false;
    let ref: SpreadsheetRef;

    if (spreadsheetId === null) {
      ref = await this.createSpreadsheet(userId);
      createdSpreadsheet = true;
      ref = await gateway.replaceTab(refreshToken, ref.spreadsheetId, EXPORT_TAB, table);
    } else {
      try {
        ref = await gateway.replaceTab(refreshToken, spreadsheetId, EXPORT_TAB, table);
      } catch (err) {
        if (!(err instanceof SheetNotAccessibleError)) throw err;
        logger.info(`Stored spreadsheet for user ${userId} is gone; creating a new one`);
        const created = await this.createSpreadsheet(userId);
        createdSpreadsheet = true;
        ref = await gateway.replaceTab(refreshToken, created.spreadsheetId, EXPORT_TAB, table);
      }
    }

    const syncedAt = new Date();
    await googleIntegrationRepository.markSynced(userId, syncedAt);
    logger.info(`Google Sheets export for user ${userId}: ${table.rows.length} rows`);

    return { ...ref, rowsWritten: table.rows.length, syncedAt, createdSpreadsheet };
  }
}

export const googleSheetsExportService = new GoogleSheetsExportService();
