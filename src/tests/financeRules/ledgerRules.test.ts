import { describe, it, expect } from 'vitest';
import { statusOf, balanceDeltaCents, balanceIncrement } from '../../services/ledgerRules';
import { toCents } from '../../utils/money';

describe('statusOf (1.1 — overspend is a status)', () => {
  it('September fixture: Gas for Car, plan 5,000 vs real 5,201.29 is exceeded', () => {
    expect(statusOf(toCents(5000), toCents(5201.29))).toBe('exceeded');
  });

  it('is pending with nothing spent', () => {
    expect(statusOf(toCents(5000), 0)).toBe('pending');
    expect(statusOf(0, 0)).toBe('pending');
  });

  it('is ok below 90% and warning from 90% up to the limit', () => {
    expect(statusOf(toCents(5000), toCents(4499.99))).toBe('ok');
    expect(statusOf(toCents(5000), toCents(4500))).toBe('warning');
    expect(statusOf(toCents(5000), toCents(5000))).toBe('warning');
  });

  it('is exceeded for any spend against a zero budget', () => {
    expect(statusOf(0, 1)).toBe('exceeded');
  });
});

describe('balanceDeltaCents', () => {
  it('credits income and debits expenses', () => {
    expect(balanceDeltaCents('income', 520129)).toBe(520129);
    expect(balanceDeltaCents('expense', 520129)).toBe(-520129);
  });

  it('rejects types that need their own primitive', () => {
    expect(() => balanceDeltaCents('transfer', 100)).toThrow(/Unsupported transaction type/);
  });

  it('moves both balance columns together', () => {
    expect(balanceIncrement(-520129)).toEqual({
      balance: { increment: -5201.29 },
      balanceCents: { increment: -520129 }
    });
  });
});
