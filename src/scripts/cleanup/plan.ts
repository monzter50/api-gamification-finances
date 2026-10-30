import { normDescriptor } from '../../services/screenshotImport/fingerprint';
import { budgetPeriodOf } from '../../services/budgetPeriod';

/**
 * Pure planning for the one-off cleanup (plan phases 3 and 4). The script
 * loads the rows, these functions decide what to change, the script prints the
 * plan and (only with --apply) executes it in one transaction.
 */

export interface CleanupTx {
  id: string
  accountId: string
  date: Date
  occurredAt: Date | null
  amountCents: number
  type: string
  vendor: string
  description: string | null
  budgetId: string | null
  expenseItemId: string | null
  incomeItemId: string | null
  createdAt: Date
  source: string
}

export interface CleanupBudget {
  id: string
  year: number
  month: number // 0-11
  expenseItems: Array<{ id: string, description: string }>
  incomeItems: Array<{ id: string, description: string }>
}

/** Same movement recorded twice: account + day + cents + type + normalised vendor. */
const duplicateKey = (t: CleanupTx): string =>
  [t.accountId, t.date.toISOString(), t.amountCents, t.type, normDescriptor(t.vendor)].join('|');

/**
 * Groups with more than one row; keep the oldest (`createdAt`), i.e. lot A.
 * Rows from the screenshot import are excluded: they are already reconciled by
 * fingerprint, and two of them with the same key are legitimate twins.
 */
export const findDuplicateGroups = (rows: CleanupTx[]): Array<{ keep: CleanupTx, remove: CleanupTx[] }> => {
  const groups = new Map<string, CleanupTx[]>();
  for (const r of rows) {
    if (r.source === 'screenshot') continue;
    const k = duplicateKey(r);
    const g = groups.get(k);
    if (g) g.push(r); else groups.set(k, [r]);
  }
  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => {
      const [keep, ...remove] = [...g].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
      return { keep: keep!, remove };
    });
};

/** "Spotify — Spotify" → "Spotify". Returns null when there is no importer suffix. */
export const stripCategorySuffix = (description: string | null): string | null => {
  if (description === null) return null;
  const at = description.lastIndexOf(' — ');
  if (at <= 0) return null;
  return description.slice(0, at).trim();
};

/** Development rows confirmed for deletion by the owner (plan, decisions table). */
export const TEST_ROWS: ReadonlyArray<{ vendor: string, amountCents: number }> = [
  { vendor: 'Salary', amountCents: 168 },
  { vendor: 'fdfd', amountCents: 77 },
  { vendor: 'Pago', amountCents: 100 },
  { vendor: 'Pay any thing', amountCents: 1050 },
  { vendor: 'Pay Check', amountCents: 150050 },
  { vendor: 'chedrauid', amountCents: 1000 }
];

export const findTestRows = (rows: CleanupTx[]): CleanupTx[] =>
  rows.filter((r) => TEST_ROWS.some((t) => t.vendor === r.vendor.trim() && t.amountCents === r.amountCents));

export interface BudgetMove {
  tx: CleanupTx
  fromBudgetId: string | null
  toBudgetId: string
  expenseItemId: string | null
  incomeItemId: string | null
  /** Item link that had no same-named item in the target budget and is cleared. */
  droppedLink: string | null
}

const sameName = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Phase 3: every row's budget must be `budgetPeriodOf(occurredAt)`.
 *  - No budget for that month → reported, row left as is.
 *  - Row's year disagrees with its current budget's year (e.g. the five 2025
 *    incomes inside a 2026 budget) → reported as "date needs confirmation",
 *    left as is: moving them would follow a date that is itself wrong.
 *  - Item links move to the same-named item in the target budget, or are cleared.
 */
export const planBudgetMoves = (
  rows: CleanupTx[],
  budgets: CleanupBudget[]
): { moves: BudgetMove[], noBudget: CleanupTx[], suspiciousYear: CleanupTx[] } => {
  const byId = new Map(budgets.map((b) => [b.id, b]));
  const byPeriod = new Map(budgets.map((b) => [`${b.year}-${b.month}`, b]));
  const moves: BudgetMove[] = [];
  const noBudget: CleanupTx[] = [];
  const suspiciousYear: CleanupTx[] = [];

  for (const tx of rows) {
    const period = budgetPeriodOf(tx.occurredAt ?? tx.date);
    const current = tx.budgetId !== null ? byId.get(tx.budgetId) : undefined;
    if (current && current.year !== period.year) { suspiciousYear.push(tx); continue; }

    const target = byPeriod.get(`${period.year}-${period.month}`);
    if (!target) { noBudget.push(tx); continue; }
    if (target.id === tx.budgetId) continue;

    let expenseItemId: string | null = null;
    let incomeItemId: string | null = null;
    let droppedLink: string | null = null;
    if (tx.expenseItemId !== null) {
      const name = current?.expenseItems.find((i) => i.id === tx.expenseItemId)?.description;
      expenseItemId = name !== undefined ? target.expenseItems.find((i) => sameName(i.description, name))?.id ?? null : null;
      if (expenseItemId === null) droppedLink = `expense item ${name ?? tx.expenseItemId}`;
    }
    if (tx.incomeItemId !== null) {
      const name = current?.incomeItems.find((i) => i.id === tx.incomeItemId)?.description;
      incomeItemId = name !== undefined ? target.incomeItems.find((i) => sameName(i.description, name))?.id ?? null : null;
      if (incomeItemId === null) droppedLink = `income item ${name ?? tx.incomeItemId}`;
    }
    moves.push({ tx, fromBudgetId: tx.budgetId, toBudgetId: target.id, expenseItemId, incomeItemId, droppedLink });
  }
  return { moves, noBudget, suspiciousYear };
};
