import { describe, it, expect } from 'vitest';
import { findDuplicateGroups, findTestRows, planBudgetMoves, stripCategorySuffix, type CleanupTx, type CleanupBudget } from '../../scripts/cleanup/plan';

let seq = 0;
const tx = (over: Partial<CleanupTx>): CleanupTx => ({
  id: `t${++seq}`,
  accountId: 'acc-1',
  date: new Date('2026-04-17T00:00:00Z'),
  occurredAt: new Date('2026-04-17T05:00:00Z'),
  amountCents: 5900,
  type: 'expense',
  vendor: 'Spotify',
  description: null,
  budgetId: 'b-apr',
  expenseItemId: null,
  incomeItemId: null,
  createdAt: new Date('2026-06-02T00:00:00Z'),
  source: 'manual',
  ...over
});

const budgets: CleanupBudget[] = [
  { id: 'b-apr', year: 2026, month: 3, expenseItems: [{ id: 'apr-subs', description: 'Suscripciones' }], incomeItems: [] },
  { id: 'b-may', year: 2026, month: 4, expenseItems: [{ id: 'may-subs', description: 'suscripciones ' }], incomeItems: [] },
  { id: 'b-jan', year: 2026, month: 0, expenseItems: [], incomeItems: [] }
];

describe('findDuplicateGroups', () => {
  it('pairs lot A and lot B and keeps the older one', () => {
    const a = tx({ description: 'Spotify — Spotify', budgetId: 'b-may' });
    const b = tx({ createdAt: new Date('2026-06-11T00:00:00Z'), budgetId: 'b-jan', vendor: 'SPOTIFY' });
    const other = tx({ amountCents: 6000 });
    const groups = findDuplicateGroups([b, other, a]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.keep.id).toBe(a.id);
    expect(groups[0]!.remove.map((r) => r.id)).toEqual([b.id]);
  });

  it('never touches screenshot-import twins (legitimate identical purchases)', () => {
    expect(findDuplicateGroups([tx({ source: 'screenshot' }), tx({ source: 'screenshot' })])).toEqual([]);
  });

  it('does not pair different accounts or types', () => {
    expect(findDuplicateGroups([tx({}), tx({ accountId: 'acc-2' }), tx({ type: 'income' })])).toEqual([]);
  });
});

describe('stripCategorySuffix', () => {
  it('removes the importer suffix', () => {
    expect(stripCategorySuffix('Spotify — Spotify')).toBe('Spotify');
    expect(stripCategorySuffix('Despensa semanal — Despensa')).toBe('Despensa semanal');
  });
  it('leaves clean descriptions alone', () => {
    expect(stripCategorySuffix('Netflix')).toBeNull();
    expect(stripCategorySuffix(null)).toBeNull();
  });
});

describe('findTestRows', () => {
  it('matches the six confirmed rows by vendor and exact amount only', () => {
    const rows = [tx({ vendor: 'Pay Check', amountCents: 150050 }), tx({ vendor: 'Pago', amountCents: 100 }), tx({ vendor: 'Pago', amountCents: 25000 })];
    expect(findTestRows(rows).map((r) => r.vendor + r.amountCents)).toEqual(['Pay Check150050', 'Pago100']);
  });
});

describe('planBudgetMoves', () => {
  it('moves a row to the budget of its own month and carries the same-named item', () => {
    const row = tx({ budgetId: 'b-may', expenseItemId: 'may-subs' });
    const { moves } = planBudgetMoves([row], budgets);
    expect(moves).toEqual([expect.objectContaining({ toBudgetId: 'b-apr', expenseItemId: 'apr-subs', droppedLink: null })]);
  });

  it('clears an item link with no same-named item in the target', () => {
    const row = tx({ budgetId: 'b-may', expenseItemId: 'ghost' });
    expect(planBudgetMoves([row], budgets).moves[0]).toMatchObject({ expenseItemId: null, droppedLink: 'expense item ghost' });
  });

  it('leaves rows already in the right budget untouched', () => {
    expect(planBudgetMoves([tx({})], budgets).moves).toEqual([]);
  });

  it('reports, but does not move, a 2025 row inside a 2026 budget', () => {
    const row = tx({ type: 'income', date: new Date('2025-04-15T00:00:00Z'), occurredAt: new Date('2025-04-15T05:00:00Z'), budgetId: 'b-may' });
    const result = planBudgetMoves([row], budgets);
    expect(result.moves).toEqual([]);
    expect(result.suspiciousYear).toEqual([row]);
  });

  it('reports rows whose month has no budget', () => {
    const row = tx({ date: new Date('2026-07-01T00:00:00Z'), occurredAt: new Date('2026-07-01T05:00:00Z'), budgetId: 'b-may' });
    expect(planBudgetMoves([row], budgets).noBudget).toEqual([row]);
  });
});
