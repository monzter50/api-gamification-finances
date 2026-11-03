import { AuthError } from '../errors/AuthErrors';

/**
 * Money helpers.
 *
 * Amounts are stored as integer cents (`amountCents`, `balanceCents`) so sums
 * are exact in both JS and Postgres. The HTTP contract still speaks decimal
 * units (pesos) — convert at the edges with `toCents` / `fromCents` and do all
 * arithmetic and comparisons in cents.
 */

/** Postgres INTEGER upper bound: 21,474,836.47 in currency units. */
const MAX_CENTS = 2_147_483_647;

export class AmountOutOfRangeError extends AuthError {
  constructor (message: string = 'Amount is out of the supported range') {
    super(message, 400, 'AMOUNT_OUT_OF_RANGE');
  }
}

/** Decimal units → integer cents, rounding to the nearest cent. */
export const toCents = (amount: number): number => {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    throw new AmountOutOfRangeError('Amount must be a finite number');
  }
  // toFixed sidesteps binary-float artifacts such as 1.005 * 100 = 100.49999…
  const cents = Math.round(Number((value * 100).toFixed(4)));
  if (Math.abs(cents) > MAX_CENTS) {
    throw new AmountOutOfRangeError();
  }
  return cents === 0 ? 0 : cents; // normalise -0
};

/** Integer cents → decimal units. */
export const fromCents = (cents: number): number => cents / 100;
