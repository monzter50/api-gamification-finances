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
