import { describe, it, expect } from 'vitest';
import { computeImportHashes, findUnmatchedCategories } from '../../services/xlsxImport/dedupe';
import { type ParsedTransaction } from '../../services/xlsxImport/types';

const row = (over: Partial<ParsedTransaction> = {}): ParsedTransaction => ({
  date: '2026-09-18',
  amount: 5201.29,
  vendor: 'Pemex',
  type: 'expense',
  category: 'Gas for Car',
  ...over
});

describe('computeImportHashes (1.4 — idempotent import)', () => {
  it('gives the same hashes when the same workbook is imported again', () => {
    const rows = [row(), row({ vendor: 'Costco', amount: 1100, category: 'Costco' })];
    expect(computeImportHashes(rows)).toEqual(computeImportHashes(rows.map((r) => ({ ...r }))));
  });

  it('keeps two genuinely identical rows apart', () => {
    const [first, second] = computeImportHashes([row(), row()]);
    expect(first).not.toBe(second);
  });

  it('is unaffected by unrelated rows being added or removed around a row', () => {
    const alone = computeImportHashes([row()]);
    const shifted = computeImportHashes([row({ vendor: 'Amazon', amount: 250 }), row()]);
    expect(shifted[1]).toBe(alone[0]);
  });

  it('ignores case and surrounding whitespace, but not the amount', () => {
    const [base] = computeImportHashes([row()]);
    expect(computeImportHashes([row({ vendor: ' pemex ', category: 'gas for car' })])[0]).toBe(base);
    expect(computeImportHashes([row({ amount: 5201.3 })])[0]).not.toBe(base);
  });
});

describe('findUnmatchedCategories (1.4 — honest import)', () => {
  it('reports each category with no matching expense item once', () => {
    const rows = [
      row(),
      row({ category: 'Amazon' }),
      row({ category: ' amazon ' }),
      row({ category: 'Seguro Carro' })
    ];
    expect(findUnmatchedCategories(rows, ['gas for car', 'Seguro Carro'])).toEqual(['Amazon']);
  });

  it('ignores rows without a category and income rows', () => {
    const rows = [row({ type: 'income', category: 'Salary' }), { ...row(), category: undefined } as ParsedTransaction];
    expect(findUnmatchedCategories(rows, [])).toEqual([]);
  });
});
