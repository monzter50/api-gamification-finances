import { describe, expect, it } from 'vitest';
import {
  buildExternalKey,
  deriveKind,
  looksTruncated,
  normalizeRows,
  parseAmount,
  parseTime,
  resolveDateHeading,
  toVendorKey
} from '../../services/receiptImport/normalize';
import type { VisionDateHeader, VisionRow } from '../../services/receiptImport/schema';

/**
 * Fixture: the five cards visible in a real BBVA "Movimientos" screenshot,
 * exactly as the vision model should transcribe them.
 */
const SAMPLE_ROWS: VisionRow[] = [
  { vendorRaw: 'Infonavit', truncated: false, amountText: '$ 9,185.27', signText: '+', subtitle: 'Pago con tarjeta', timeText: '19:48 h' },
  { vendorRaw: 'City club1044 hua…', truncated: true, amountText: '$ 182.09', signText: '+', subtitle: 'Pago con tarjeta', timeText: '17:32 h' },
  { vendorRaw: 'Gasol arco kabah', truncated: false, amountText: '$ 1,070.96', signText: '+', subtitle: 'Pago con tarjeta', timeText: '16:12 h' },
  { vendorRaw: 'Bmovil.pago tdc', truncated: false, amountText: '$ -3,200.00', signText: '-', subtitle: 'Movimiento BBVA', timeText: '10:51 h' },
  { vendorRaw: 'Merpago*agregador', truncated: false, amountText: '$ 55.97', signText: '+', subtitle: 'Pago con tarjeta', timeText: '10:36 h' }
];

const SAMPLE_HEADERS: VisionDateHeader[] = [
  { raw: '22 de junio', appliesToRows: [0, 1, 2, 3, 4] }
];

const REFERENCE = new Date(2026, 8, 14); // 14 Sep 2026

describe('parseAmount', () => {
  it('parses Mexican-format currency', () => {
    expect(parseAmount('$ 9,185.27')).toBe(9185.27);
    expect(parseAmount('$ 55.97')).toBe(55.97);
  });

  it('returns the absolute value — sign is tracked separately', () => {
    expect(parseAmount('$ -3,200.00')).toBe(3200);
  });

  it('returns null for unreadable text rather than guessing', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('$ --')).toBeNull();
  });

  it('rejects implausible amounts as misreads', () => {
    expect(parseAmount('$ 999,999,999,999.00')).toBeNull();
  });
});

describe('parseTime', () => {
  it('strips the trailing h', () => {
    expect(parseTime('19:48 h')).toBe('19:48');
    expect(parseTime('10:36 h')).toBe('10:36');
  });

  it('returns null when no time is shown', () => {
    expect(parseTime(null)).toBeNull();
    expect(parseTime('Pago con tarjeta')).toBeNull();
  });

  it('rejects impossible clock values', () => {
    expect(parseTime('99:99 h')).toBeNull();
  });
});

describe('resolveDateHeading', () => {
  it('infers the current year when the date is in the past', () => {
    expect(resolveDateHeading('22 de junio', REFERENCE))
      .toEqual({ date: '2026-06-22', yearInferred: true });
  });

  it('rolls back a year rather than dating a row in the future', () => {
    // Importing a December statement in January must not land in December 2026.
    const january = new Date(2026, 0, 5);
    expect(resolveDateHeading('28 de diciembre', january))
      .toEqual({ date: '2025-12-28', yearInferred: true });
  });

  it('handles accented month names', () => {
    expect(resolveDateHeading('3 de marzo', REFERENCE))
      .toEqual({ date: '2026-03-03', yearInferred: true });
  });

  it('prefers an explicit year over inference', () => {
    const resolved = resolveDateHeading('22 de junio 2024', REFERENCE);
    expect(resolved).toEqual({ date: '2024-06-22', yearInferred: false });
  });

  it('returns null for text that is not a date', () => {
    expect(resolveDateHeading('Movimientos', REFERENCE)).toBeNull();
  });
});

describe('deriveKind', () => {
  it('reads a credit-card view: positive is a charge, negative is a payment', () => {
    expect(deriveKind('+', 'credit')).toBe('expense');
    expect(deriveKind('-', 'credit')).toBe('transfer');
  });

  it('reads a debit view the other way round', () => {
    expect(deriveKind('+', 'debit')).toBe('income');
    expect(deriveKind('-', 'debit')).toBe('expense');
  });
});

describe('toVendorKey / looksTruncated', () => {
  it('normalizes case, accents and spacing', () => {
    expect(toVendorKey('  Gasól   ARCO  Kabah ')).toBe('gasol arco kabah');
  });

  it('detects UI truncation', () => {
    expect(looksTruncated('City club1044 hua…')).toBe(true);
    expect(looksTruncated('City club1044 hua...')).toBe(true);
    expect(looksTruncated('Infonavit')).toBe(false);
  });
});

describe('normalizeRows — the sample screenshot', () => {
  const result = normalizeRows(SAMPLE_ROWS, SAMPLE_HEADERS, {
    accountKind: 'credit',
    referenceDate: REFERENCE
  });

  it('returns every card', () => {
    expect(result.rows).toHaveLength(5);
  });

  it('books the card payment as a transfer, not an expense', () => {
    const payment = result.rows.find((r) => r.vendorRaw === 'Bmovil.pago tdc');
    expect(payment?.kind).toBe('transfer');
    expect(payment?.amountAbs).toBe(3200);
    expect(payment?.needsReview).toBe(true);
    expect(payment?.reviewReasons).toContain('transfer_detected');
  });

  it('books ordinary charges as expenses', () => {
    const gas = result.rows.find((r) => r.vendorRaw === 'Gasol arco kabah');
    expect(gas?.kind).toBe('expense');
    expect(gas?.amountAbs).toBe(1070.96);
    expect(gas?.occurredAt).toBe('2026-06-22T16:12:00');
  });

  it('flags the truncated vendor and never invents the missing tail', () => {
    const truncated = result.rows.find((r) => r.truncated);
    expect(truncated?.vendorRaw).toBe('City club1044 hua…');
    expect(truncated?.reviewReasons).toContain('truncated_vendor');
  });

  it('flags every row as year-inferred, since the header shows no year', () => {
    expect(result.rows.every((r) => r.yearInferred)).toBe(true);
  });

  it('gives every row a distinct external key', () => {
    const keys = new Set(result.rows.map((r) => r.externalKey));
    expect(keys.size).toBe(5);
  });
});

describe('normalizeRows — overlapping screenshots', () => {
  it('drops rows repeated across scrolls', () => {
    const overlapping = [...SAMPLE_ROWS, SAMPLE_ROWS[2], SAMPLE_ROWS[4]] as VisionRow[];
    const headers: VisionDateHeader[] = [
      { raw: '22 de junio', appliesToRows: [0, 1, 2, 3, 4, 5, 6] }
    ];

    const result = normalizeRows(overlapping, headers, {
      accountKind: 'credit',
      referenceDate: REFERENCE
    });

    expect(result.rows).toHaveLength(5);
    expect(result.duplicatesInBatch).toBe(2);
    expect(result.warnings.some((w) => w.includes('duplicate'))).toBe(true);
  });
});

describe('normalizeRows - under-specified date headings', () => {
  it('forward-fills a heading the model only partly mapped', () => {
    // Real qwen2.5-vl output: the heading covers five rows but the model
    // only claimed the first two. Every row must still get the date.
    const stingy: VisionDateHeader[] = [{ raw: '22 de junio', appliesToRows: [0, 1] }];

    const result = normalizeRows(SAMPLE_ROWS, stingy, {
      accountKind: 'credit',
      referenceDate: REFERENCE
    });

    expect(result.rows).toHaveLength(5);
    expect(result.rows.every((r) => r.date === '2026-06-22')).toBe(true);
    expect(result.rows.some((r) => r.reviewReasons.includes('missing_date'))).toBe(false);
  });

  it('switches to the next heading at its first claimed row', () => {
    const headers: VisionDateHeader[] = [
      { raw: '22 de junio', appliesToRows: [0] },
      { raw: '21 de junio', appliesToRows: [3] }
    ];

    const result = normalizeRows(SAMPLE_ROWS, headers, {
      accountKind: 'credit',
      referenceDate: REFERENCE
    });

    expect(result.rows.map((r) => r.date))
      .toEqual(['2026-06-22', '2026-06-22', '2026-06-22', '2026-06-21', '2026-06-21']);
  });

  it('governs from row 0 even when the model claims a later start', () => {
    const headers: VisionDateHeader[] = [{ raw: '22 de junio', appliesToRows: [2, 3] }];

    const result = normalizeRows(SAMPLE_ROWS, headers, {
      accountKind: 'credit',
      referenceDate: REFERENCE
    });

    expect(result.rows[0]?.date).toBe('2026-06-22');
  });
});

describe('normalizeRows - primaryDateHeading fallback', () => {
  it('dates every row from the fallback when dateHeaders comes back empty', () => {
    // qwen2.5-vl reliably fills primaryDateHeading but often returns an empty
    // dateHeaders array. The fallback is what keeps rows from losing dates.
    const result = normalizeRows(SAMPLE_ROWS, [], {
      accountKind: 'credit',
      referenceDate: REFERENCE,
      primaryDateHeading: '22 de junio'
    });

    expect(result.rows.every((r) => r.date === '2026-06-22')).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('prefers explicit dateHeaders over the fallback', () => {
    const result = normalizeRows(SAMPLE_ROWS, [{ raw: '21 de junio', appliesToRows: [0] }], {
      accountKind: 'credit',
      referenceDate: REFERENCE,
      primaryDateHeading: '22 de junio'
    });

    expect(result.rows.every((r) => r.date === '2026-06-21')).toBe(true);
  });

  it('warns when neither source yields a date', () => {
    const result = normalizeRows(SAMPLE_ROWS, [], {
      accountKind: 'credit',
      referenceDate: REFERENCE,
      primaryDateHeading: null
    });

    expect(result.rows.every((r) => r.date === null)).toBe(true);
    expect(result.warnings.some((w) => w.includes('No date heading'))).toBe(true);
    expect(result.rows.every((r) => r.reviewReasons.includes('missing_date'))).toBe(true);
  });

  it('warns when a heading is present but unparseable', () => {
    const result = normalizeRows(SAMPLE_ROWS, [], {
      accountKind: 'credit',
      referenceDate: REFERENCE,
      primaryDateHeading: 'Movimientos'
    });

    expect(result.warnings.some((w) => w.includes('could not be parsed'))).toBe(true);
  });
});

describe('buildExternalKey', () => {
  it('is stable across runs', () => {
    const parts = { date: '2026-06-22', time: '16:12', vendorKey: 'gasol arco kabah', amountAbs: 1070.96, signRaw: '+' as const };
    expect(buildExternalKey(parts)).toBe(buildExternalKey(parts));
  });

  it('changes when the amount changes', () => {
    const base = { date: '2026-06-22', time: '16:12', vendorKey: 'gasol arco kabah', signRaw: '+' as const };
    expect(buildExternalKey({ ...base, amountAbs: 1070.96 }))
      .not.toBe(buildExternalKey({ ...base, amountAbs: 1070.9 }));
  });
});
