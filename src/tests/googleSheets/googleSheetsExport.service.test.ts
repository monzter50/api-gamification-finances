import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomBytes } from 'crypto';
import { GoogleSheetsExportService, EXPORT_TAB, OAUTH_STATE_PURPOSE, MAX_EXPORT_ROWS } from '../../services/googleSheets/googleSheetsExport.service';
import { type GoogleGateway } from '../../services/googleSheets/googleGateway.port';
import { googleIntegrationRepository } from '../../repositories/googleIntegration.repository';
import { transactionRepository } from '../../repositories/transaction.repository';
import { budgetRepository } from '../../repositories/budget.repository';
import { encryptSecret, decryptSecret } from '../../utils/crypto';
import { createSignedState } from '../../utils/signedState';
import {
  ExportTooLargeError,
  GoogleNotConfiguredError,
  GoogleNotConnectedError,
  GoogleReauthRequiredError,
  SheetNotAccessibleError
} from '../../errors/GoogleErrors';
import { BudgetNotFoundError } from '../../errors/DomainErrors';

vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));
vi.mock('../../repositories/googleIntegration.repository', () => ({
  googleIntegrationRepository: {
    findByUser: vi.fn(),
    upsertConnection: vi.fn(),
    setSpreadsheet: vi.fn(),
    markSynced: vi.fn(),
    deleteByUser: vi.fn()
  }
}));
vi.mock('../../repositories/transaction.repository', () => ({
  transactionRepository: { findForExport: vi.fn() }
}));
vi.mock('../../repositories/budget.repository', () => ({
  budgetRepository: { findByIdAndUser: vi.fn() }
}));

const USER = 'user-1';
const REFRESH = '1//refresh-token';
const DRIVE_FILE = 'https://www.googleapis.com/auth/drive.file';

process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.GOOGLE_CLIENT_ID = 'client-id';
process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
process.env.GOOGLE_REDIRECT_URI = 'https://api.example.com/api/integrations/google/callback';
process.env.FRONTEND_URL = 'https://app.example.com/';

const fakeGateway = (): { [K in keyof GoogleGateway]: ReturnType<typeof vi.fn> } => ({
  buildConsentUrl: vi.fn((state: string) => `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`),
  exchangeCode: vi.fn(async () => ({ refreshToken: REFRESH, scope: `openid email ${DRIVE_FILE}`, email: 'ana@gmail.com' })),
  revoke: vi.fn(async () => undefined),
  createSpreadsheet: vi.fn(async () => ({ spreadsheetId: 'new-sheet', spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/new-sheet' })),
  replaceTab: vi.fn(async (_t: string, id: string) => ({ spreadsheetId: id, spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${id}` }))
});

let gw: ReturnType<typeof fakeGateway>;
let service: GoogleSheetsExportService;

const connectedRow = (spreadsheetId: string | null = 'sheet-1') => ({
  id: 'gi-1',
  userId: USER,
  googleEmail: 'ana@gmail.com',
  refreshTokenEnc: encryptSecret(REFRESH, USER),
  scope: DRIVE_FILE,
  spreadsheetId,
  lastSyncAt: null,
  createdAt: new Date(),
  updatedAt: new Date()
});

const exportTx = {
  id: 'tx-1',
  date: new Date('2026-09-18T00:00:00Z'),
  type: 'expense',
  amountCents: 1000,
  vendor: 'Oxxo',
  description: null,
  account: { name: 'Cash', currency: 'MXN' },
  budget: { year: 2026, month: 8 },
  incomeItem: null,
  expenseItem: null
};

beforeEach(() => {
  vi.clearAllMocks();
  gw = fakeGateway();
  service = new GoogleSheetsExportService(() => gw as unknown as GoogleGateway);
  vi.mocked(googleIntegrationRepository.findByUser).mockResolvedValue(connectedRow() as never);
  vi.mocked(transactionRepository.findForExport).mockResolvedValue([exportTx] as never);
});

describe('connect + callback', () => {
  it('builds a consent URL whose state is bound to the user', () => {
    const url = service.getConnectUrl(USER);
    expect(url).toContain('accounts.google.com');
    expect(gw.buildConsentUrl).toHaveBeenCalledOnce();
  });

  it('is unavailable (503) when the server has no Google credentials', () => {
    const unconfigured = new GoogleSheetsExportService(() => null);
    expect(() => unconfigured.getConnectUrl(USER)).toThrow(GoogleNotConfiguredError);
  });

  it('stores the refresh token ENCRYPTED for the user named in the state', async () => {
    const state = createSignedState(USER, OAUTH_STATE_PURPOSE, process.env.JWT_SECRET as string);
    const location = await service.handleCallback({ code: 'auth-code', state });

    expect(location).toBe('https://app.example.com/settings/integrations?google=connected');
    const [userId, data] = vi.mocked(googleIntegrationRepository.upsertConnection).mock.calls[0] as [string, { refreshTokenEnc: string }];
    expect(userId).toBe(USER);
    expect(data.refreshTokenEnc).not.toContain(REFRESH);
    expect(decryptSecret(data.refreshTokenEnc, USER)).toBe(REFRESH);
  });

  it('rejects a forged/foreign state without exchanging the code', async () => {
    const location = await service.handleCallback({ code: 'auth-code', state: 'forged.state' });
    expect(location).toContain('google=error&reason=invalid_state');
    expect(gw.exchangeCode).not.toHaveBeenCalled();
    expect(googleIntegrationRepository.upsertConnection).not.toHaveBeenCalled();
  });

  it('refuses a grant without drive.file and revokes it', async () => {
    gw.exchangeCode.mockResolvedValue({ refreshToken: REFRESH, scope: 'openid email', email: null });
    const state = createSignedState(USER, OAUTH_STATE_PURPOSE, process.env.JWT_SECRET as string);
    expect(await service.handleCallback({ code: 'c', state })).toContain('reason=missing_scope');
    expect(gw.revoke).toHaveBeenCalledWith(REFRESH);
    expect(googleIntegrationRepository.upsertConnection).not.toHaveBeenCalled();
  });

  it('maps a Google "access_denied" to a redirect, never an error page', async () => {
    expect(await service.handleCallback({ error: 'access_denied' })).toContain('reason=access_denied');
  });

  it('redirects only to FRONTEND_URL, whatever the query contains', async () => {
    const location = await service.handleCallback({ code: 'c', state: 'x', error: undefined, redirect: 'https://evil.example' } as never);
    expect(location.startsWith('https://app.example.com/')).toBe(true);
  });
});

describe('sync', () => {
  it('requires a connected Google account', async () => {
    vi.mocked(googleIntegrationRepository.findByUser).mockResolvedValue(null);
    await expect(service.sync(USER)).rejects.toBeInstanceOf(GoogleNotConnectedError);
  });

  it('writes to the existing spreadsheet, only into the app tab', async () => {
    const result = await service.sync(USER);
    expect(gw.replaceTab).toHaveBeenCalledWith(REFRESH, 'sheet-1', EXPORT_TAB, expect.objectContaining({ rows: expect.any(Array) }));
    expect(gw.createSpreadsheet).not.toHaveBeenCalled();
    expect(result).toMatchObject({ spreadsheetId: 'sheet-1', rowsWritten: 1, createdSpreadsheet: false });
    expect(googleIntegrationRepository.markSynced).toHaveBeenCalledWith(USER, expect.any(Date));
  });

  it('creates the spreadsheet on first sync', async () => {
    vi.mocked(googleIntegrationRepository.findByUser).mockResolvedValue(connectedRow(null) as never);
    const result = await service.sync(USER);
    expect(gw.createSpreadsheet).toHaveBeenCalledOnce();
    expect(googleIntegrationRepository.setSpreadsheet).toHaveBeenCalledWith(USER, 'new-sheet');
    expect(result).toMatchObject({ spreadsheetId: 'new-sheet', createdSpreadsheet: true });
  });

  it('re-creates the spreadsheet when the user deleted it', async () => {
    gw.replaceTab.mockRejectedValueOnce(new SheetNotAccessibleError());
    const result = await service.sync(USER);
    expect(gw.createSpreadsheet).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ spreadsheetId: 'new-sheet', createdSpreadsheet: true });
  });

  it('only exports the caller\'s own data (query scoped by userId, bounded)', async () => {
    await service.sync(USER, { from: new Date('2026-09-01'), to: new Date('2026-09-30') });
    expect(transactionRepository.findForExport).toHaveBeenCalledWith(USER, expect.any(Object), MAX_EXPORT_ROWS + 1);
  });

  it('rejects another user\'s budget filter as not found', async () => {
    vi.mocked(budgetRepository.findByIdAndUser).mockResolvedValue(null);
    await expect(service.sync(USER, { budgetId: 'budget-of-someone-else' })).rejects.toBeInstanceOf(BudgetNotFoundError);
    expect(gw.replaceTab).not.toHaveBeenCalled();
  });

  it('refuses exports above the row cap', async () => {
    vi.mocked(transactionRepository.findForExport).mockResolvedValue(new Array(MAX_EXPORT_ROWS + 1).fill(exportTx) as never);
    await expect(service.sync(USER)).rejects.toBeInstanceOf(ExportTooLargeError);
  });

  it('asks to reconnect when the stored token can\'t be decrypted (rotated key / tampered row)', async () => {
    vi.mocked(googleIntegrationRepository.findByUser).mockResolvedValue({ ...connectedRow(), refreshTokenEnc: encryptSecret(REFRESH, 'other-user') } as never);
    await expect(service.sync(USER)).rejects.toBeInstanceOf(GoogleReauthRequiredError);
  });
});

describe('disconnect', () => {
  it('revokes at Google and deletes the local grant', async () => {
    await service.disconnect(USER);
    expect(gw.revoke).toHaveBeenCalledWith(REFRESH);
    expect(googleIntegrationRepository.deleteByUser).toHaveBeenCalledWith(USER);
  });

  it('still deletes the local grant when Google revoke fails', async () => {
    gw.revoke.mockRejectedValue(new Error('network'));
    await service.disconnect(USER);
    expect(googleIntegrationRepository.deleteByUser).toHaveBeenCalledWith(USER);
  });

  it('is idempotent when not connected', async () => {
    vi.mocked(googleIntegrationRepository.findByUser).mockResolvedValue(null);
    await service.disconnect(USER);
    expect(gw.revoke).not.toHaveBeenCalled();
  });
});
