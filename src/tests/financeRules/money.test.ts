import { describe, it, expect } from 'vitest';
import { toCents, fromCents, AmountOutOfRangeError } from '../../utils/money';

describe('money (1.3 — integer cents)', () => {
  it('converts decimal units to cents without float artifacts', () => {
    expect(toCents(5201.29)).toBe(520129);
    expect(toCents(1.005)).toBe(101);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(-0)).toBe(0);
  });

  it('sums exactly where floats do not', () => {
    const amounts = [0.1, 0.2, 0.3, 1551.5, 5971.55];
    const cents = amounts.reduce((sum, a) => sum + toCents(a), 0);
    expect(fromCents(cents)).toBe(7523.65);
  });

  it('rejects amounts that do not fit the INTEGER column', () => {
    expect(() => toCents(21_474_836.48)).toThrow(AmountOutOfRangeError);
    expect(() => toCents(Number.NaN)).toThrow(AmountOutOfRangeError);
  });
});
