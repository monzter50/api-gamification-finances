/**
 * Budget line status — the "Estado" column of the spreadsheet.
 *
 * Overspending is a STATE the API reports, never an error: the ledger records
 * what actually happened, and the budget tells you how it compares to the plan.
 */
export type ItemStatus = 'pending' | 'ok' | 'warning' | 'exceeded';

/** Share of the budgeted amount at which a line turns to `warning`. */
export const WARNING_THRESHOLD = 0.9;

/** Both arguments are integer cents. */
export const statusOf = (budgetedCents: number, spentCents: number): ItemStatus => {
  if (spentCents === 0) return 'pending';
  if (spentCents > budgetedCents) return 'exceeded';
  return spentCents / budgetedCents >= WARNING_THRESHOLD ? 'warning' : 'ok';
};

/**
 * Signed effect of a transaction on its account balance, in cents.
 *  - income  → +amount (credit)
 *  - expense → -amount (debit)
 * Shared by every path that writes transactions (API and Excel import) so the
 * rule does not depend on where the data comes in.
 */
export const balanceDeltaCents = (type: string, amountCents: number): number => {
  if (type === 'income') return amountCents;
  if (type === 'expense') return -amountCents;
  throw new Error(
    `Unsupported transaction type "${type}" for balance update. Expected 'income' or 'expense'.`
  );
};

/**
 * Prisma `data` fragment that moves an account balance by `deltaCents`,
 * keeping the legacy Float column in step until it is dropped.
 */
export const balanceIncrement = (deltaCents: number): {
  balance: { increment: number }
  balanceCents: { increment: number }
} => ({
  balance: { increment: deltaCents / 100 },
  balanceCents: { increment: deltaCents }
});
