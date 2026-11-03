import { IMPORT_TIME_ZONE, localParts } from '../utils/localTime';

/**
 * The budget a movement belongs to, derived from WHEN it happened — never
 * chosen by the caller. `month` follows the Budget convention: 0-11
 * (January = 0), the same as `GET /budgets?month=`.
 *
 * The month is read in the user's local time zone: a purchase at 21:00 on
 * 31 October in Cancun is 02:00 on 1 November UTC, and belongs to October.
 */
export const budgetPeriodOf = (
  occurredAt: Date,
  timeZone: string = IMPORT_TIME_ZONE
): { year: number, month: number } => {
  const { year, month } = localParts(occurredAt, timeZone);
  return { year, month: month - 1 };
};
