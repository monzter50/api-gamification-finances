import { createHash } from 'crypto';
import { toCents } from '../../utils/money';
import { type ParsedTransaction } from './types';

/** Case/whitespace-insensitive key used to match categories and item names. */
export const normalizeKey = (value: string): string => value.trim().toLowerCase();

/**
 * Stable identity for each imported row, so confirming the same workbook twice
 * does not duplicate transactions.
 *
 * The hash covers date, amount (cents), vendor, category and an occurrence
 * ordinal: the Nth row with the same four values gets ordinal N. The ordinal
 * plays the role of the sheet row number — it keeps two genuinely identical
 * purchases apart — but, unlike a row number, it survives rows being inserted,
 * removed or reordered elsewhere in the sheet or in the review step.
 */
export const computeImportHashes = (rows: ParsedTransaction[]): string[] => {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const identity = [
      row.date.slice(0, 10),
      toCents(row.amount),
      normalizeKey(row.vendor),
      normalizeKey(row.category ?? ''),
      row.type
    ].join('|');
    const ordinal = seen.get(identity) ?? 0;
    seen.set(identity, ordinal + 1);
    return createHash('sha256').update(`${identity}|${ordinal}`).digest('hex');
  });
};

// ---------------------------------------------------------------------------
// Legacy rows: transactions written before `importHash` existed (migration
// 20261013120000) have `importHash = null`, so the hash check alone cannot see
// them and re-importing the same workbook would duplicate them again.
// ---------------------------------------------------------------------------

/** A ledger row as stored, reduced to what identifies it. */
export interface LedgerIdentityRow {
  id: string
  date: Date
  amountCents: number
  vendor: string
  type: string
  createdAt: Date
}

const dayOf = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Identity WITHOUT category: legacy rows don't reliably carry one (unlinked
 * rows have no expense item, and income rows never had one), so including it
 * would make legacy rows unmatchable.
 */
const legacyIdentity = (day: string, amountCents: number, vendor: string, type: string): string =>
  [day, amountCents, normalizeKey(vendor), type].join('|');

/**
 * Pairs incoming rows with legacy (hash-less) rows that already represent
 * them. Returns, per incoming row, the id of the legacy row it matches, or
 * `null`.
 *
 * Occurrence-aware, like `computeImportHashes`: with two identical incoming
 * rows and one identical legacy row, only the FIRST incoming row matches — the
 * second is a genuine new purchase. Legacy rows are consumed oldest-first.
 *
 * `isEligible(index)` lets the caller exclude rows it already decided on (for
 * example, rows whose hash is already in the ledger).
 */
export const matchLegacyRows = (
  rows: ParsedTransaction[],
  legacy: LedgerIdentityRow[],
  isEligible: (index: number) => boolean = () => true
): Array<string | null> => {
  const pending = new Map<string, string[]>();
  for (const row of [...legacy].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const key = legacyIdentity(dayOf(row.date), row.amountCents, row.vendor, row.type);
    const queue = pending.get(key) ?? [];
    queue.push(row.id);
    pending.set(key, queue);
  }

  return rows.map((row, index) => {
    if (!isEligible(index)) { return null; }
    const key = legacyIdentity(row.date.slice(0, 10), toCents(row.amount), row.vendor, row.type);
    return pending.get(key)?.shift() ?? null;
  });
};

// ---------------------------------------------------------------------------
// Cleanup planning for duplicates that already reached the ledger.
// ---------------------------------------------------------------------------

export interface LedgerRow extends LedgerIdentityRow {
  userId: string
  accountId: string
  importHash: string | null
}

export interface DuplicateGroup {
  key: string
  keep: LedgerRow[]
  remove: LedgerRow[]
}

/** Rows created further apart than this belong to different import runs. */
export const DEFAULT_BATCH_GAP_MS = 60_000;

/**
 * Plans which rows to delete so each real-world movement appears once.
 *
 * Rows are grouped by (user, account, day, cents, vendor, type). Inside a
 * group, rows are split into import BATCHES by `createdAt` (a gap larger than
 * `batchGapMs` starts a new batch). One import run can legitimately contain
 * the same purchase twice (two identical coffees), but a re-import repeats the
 * whole batch — so the number of genuine occurrences is the size of the
 * LARGEST batch, and everything beyond that is a duplicate.
 *
 * Survivors: rows that already carry an `importHash` first (they're what the
 * import path recognises), then the oldest — the first import is the one that
 * was reviewed and attached to the right budget.
 *
 * Caveat: two identical manual entries typed more than `batchGapMs` apart look
 * like a re-import. That's why the script defaults to a dry run.
 */
export const planDuplicateCleanup = (
  rows: LedgerRow[],
  batchGapMs: number = DEFAULT_BATCH_GAP_MS
): DuplicateGroup[] => {
  const groups = new Map<string, LedgerRow[]>();
  for (const row of rows) {
    const key = [row.userId, row.accountId, legacyIdentity(dayOf(row.date), row.amountCents, row.vendor, row.type)].join('|');
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const plan: DuplicateGroup[] = [];
  for (const [key, group] of groups) {
    if (group.length < 2) { continue; }

    const byCreation = [...group].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    let largestBatch = 0;
    let currentBatch = 0;
    let previous: Date | null = null;
    for (const row of byCreation) {
      const sameBatch = previous !== null && row.createdAt.getTime() - previous.getTime() <= batchGapMs;
      currentBatch = sameBatch ? currentBatch + 1 : 1;
      largestBatch = Math.max(largestBatch, currentBatch);
      previous = row.createdAt;
    }
    if (largestBatch >= group.length) { continue; }

    const ranked = [...byCreation].sort((a, b) =>
      Number(b.importHash !== null) - Number(a.importHash !== null) ||
      a.createdAt.getTime() - b.createdAt.getTime()
    );
    plan.push({ key, keep: ranked.slice(0, largestBatch), remove: ranked.slice(largestBatch) });
  }
  return plan;
};

/**
 * Categories used by expense rows that match none of the given item names —
 * the "Chequeos" sheet. Those rows still import, but land without an expense
 * item, so they would be missing from the plan-vs-actual report.
 */
export const findUnmatchedCategories = (
  rows: ParsedTransaction[],
  itemDescriptions: string[]
): string[] => {
  const known = new Set(itemDescriptions.map(normalizeKey));
  const unmatched = new Map<string, string>();
  for (const row of rows) {
    if (row.type !== 'expense' || !row.category) { continue; }
    const key = normalizeKey(row.category);
    if (!known.has(key) && !unmatched.has(key)) { unmatched.set(key, row.category.trim()); }
  }
  return Array.from(unmatched.values());
};
