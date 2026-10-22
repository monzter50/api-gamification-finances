import { describe, it, expect } from 'vitest';
import {
  computeImportHashes,
  matchLegacyRows,
  planDuplicateCleanup,
  type LedgerIdentityRow,
  type LedgerRow
} from '../../services/xlsxImport/dedupe';
import { type ParsedTransaction } from '../../services/xlsxImport/types';

const parsed = (over: Partial<ParsedTransaction> = {}): ParsedTransaction => ({
  date: '2026-04-15',
  amount: 1069.28,
  vendor: 'Pemex',
  type: 'expense',
  category: 'Gas for Car',
  ...over
});

let seq = 0;
const ledger = (over: Partial<LedgerRow> = {}): LedgerRow => ({
  id: `tx-${++seq}`,
  userId: 'user-1',
  accountId: 'bbva',
  date: new Date('2026-04-15T00:00:00.000Z'),
  amountCents: 106928,
  vendor: 'Pemex',
  type: 'expense',
  importHash: null,
  createdAt: new Date('2026-06-02T19:59:14.940Z'),
  ...over
});

const legacy = (over: Partial<LedgerIdentityRow> = {}): LedgerIdentityRow => {
  const { id, date, amountCents, vendor, type, createdAt } = ledger(over);
  return { id, date, amountCents, vendor, type, createdAt };
};

describe('matchLegacyRows (re-import must not duplicate pre-hash rows)', () => {
  it('matches an incoming row to the hash-less row that already represents it', () => {
    const old = legacy({ id: 'old' });
    expect(matchLegacyRows([parsed()], [old])).toEqual(['old']);
  });

  it('ignores case and whitespace in the vendor, and the category entirely', () => {
    const old = legacy({ id: 'old', vendor: 'PEMEX ' });
    expect(matchLegacyRows([parsed({ category: 'Otra cosa' })], [old])).toEqual(['old']);
  });

  it('is occurrence-aware: one legacy row absorbs only one of two identical incoming rows', () => {
    const old = legacy({ id: 'old' });
    expect(matchLegacyRows([parsed(), parsed()], [old])).toEqual(['old', null]);
  });

  it('consumes legacy rows oldest-first', () => {
    const newer = legacy({ id: 'newer', createdAt: new Date('2026-06-11T17:13:56.952Z') });
    const older = legacy({ id: 'older' });
    expect(matchLegacyRows([parsed()], [newer, older])).toEqual(['older']);
  });

  it('does not match on a different amount, day or type', () => {
    const old = legacy({ id: 'old' });
    expect(matchLegacyRows([
      parsed({ amount: 1069.29 }),
      parsed({ date: '2026-04-16' }),
      parsed({ type: 'income' })
    ], [old])).toEqual([null, null, null]);
  });

  it('skips rows the caller marks as ineligible (already matched by hash)', () => {
    const old = legacy({ id: 'old' });
    const rows = [parsed(), parsed()];
    const [hashed] = computeImportHashes(rows);
    const alreadyImported = new Set([hashed]);
    const hashes = computeImportHashes(rows);
    expect(matchLegacyRows(rows, [old], (i) => !alreadyImported.has(hashes[i]!))).toEqual([null, 'old']);
  });
});

describe('planDuplicateCleanup', () => {
  const june02 = new Date('2026-06-02T19:59:14.940Z');
  const june11 = new Date('2026-06-11T17:13:56.952Z');

  it('collapses a whole re-imported batch, keeping the first import', () => {
    const first = ledger({ id: 'first', createdAt: june02 });
    const again = ledger({ id: 'again', createdAt: june11 });
    const plan = planDuplicateCleanup([again, first]);
    expect(plan).toHaveLength(1);
    expect(plan[0]!.keep.map((r) => r.id)).toEqual(['first']);
    expect(plan[0]!.remove.map((r) => r.id)).toEqual(['again']);
  });

  it('keeps two identical purchases from the same import run', () => {
    const a = ledger({ createdAt: june02 });
    const b = ledger({ createdAt: new Date(june02.getTime() + 5) });
    expect(planDuplicateCleanup([a, b])).toEqual([]);
  });

  it('a re-import of a batch with two identical purchases keeps two, removes two', () => {
    const rows = [
      ledger({ id: 'a1', createdAt: june02 }),
      ledger({ id: 'a2', createdAt: new Date(june02.getTime() + 3) }),
      ledger({ id: 'b1', createdAt: june11 }),
      ledger({ id: 'b2', createdAt: new Date(june11.getTime() + 3) })
    ];
    const [group] = planDuplicateCleanup(rows);
    expect(group!.keep.map((r) => r.id)).toEqual(['a1', 'a2']);
    expect(group!.remove.map((r) => r.id)).toEqual(['b1', 'b2']);
  });

  it('prefers a row that already carries an importHash over an older hash-less one', () => {
    const legacyRow = ledger({ id: 'legacy', createdAt: june02 });
    const hashed = ledger({ id: 'hashed', createdAt: june11, importHash: 'h' });
    const [group] = planDuplicateCleanup([legacyRow, hashed]);
    expect(group!.keep.map((r) => r.id)).toEqual(['hashed']);
  });

  it('never groups across accounts or users', () => {
    const rows = [
      ledger({ createdAt: june02 }),
      ledger({ createdAt: june11, accountId: 'vales' }),
      ledger({ createdAt: june11, userId: 'user-2' })
    ];
    expect(planDuplicateCleanup(rows)).toEqual([]);
  });

  it('treats a wider batch gap as one run (escape hatch for slow manual imports)', () => {
    const a = ledger({ createdAt: june02 });
    const b = ledger({ createdAt: new Date(june02.getTime() + 90_000) });
    expect(planDuplicateCleanup([a, b])).toHaveLength(1);
    expect(planDuplicateCleanup([a, b], 120_000)).toEqual([]);
  });
});
