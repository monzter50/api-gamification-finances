import { createHash } from 'crypto';
import { IMPORT_TIME_ZONE, fromLocal, toLocalMinute } from '../../utils/localTime';

/**
 * Natural key of a movement seen in a bank screenshot. The list view carries
 * no folio or authorisation number, so identity is: account + local minute +
 * amount + type + normalised merchant descriptor.
 *
 * KEEP IN SYNC with the backfill SQL in
 * prisma/migrations/20261030120000_screenshot_import_idempotency.
 */

/** "Amazon.com Inc AMZN" and "Amazoncom inc amzn" → "amazoncomincamzn". */
export const normDescriptor = (raw: string): string =>
  raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export interface FingerprintInput {
  userId: string
  accountId: string
  occurredAt: Date
  amountCents: number
  type: string
  descriptorNorm: string
}

export const fingerprintOf = (t: FingerprintInput, timeZone: string = IMPORT_TIME_ZONE): string =>
  createHash('sha256')
    .update([
      t.userId,
      t.accountId,
      toLocalMinute(t.occurredAt, timeZone),
      String(t.amountCents),
      t.type,
      t.descriptorNorm
    ].join('|'))
    .digest('hex');

/**
 * The screenshot shows "23 de octubre" and "10:10" but no year. Use the year of
 * the upload; if that lands in the future (more than a day ahead, to absorb
 * clock skew), it was last year: "28 dic" uploaded on 3 Jan → previous year.
 *
 * `month` is 1-12 (how the screenshot reads), `time` is "HH:mm" local.
 */
export const inferOccurredAt = (
  row: { day: number, month: number, time: string },
  uploadedAt: Date,
  timeZone: string = IMPORT_TIME_ZONE
): Date => {
  const [hour, minute] = row.time.split(':').map(Number) as [number, number];
  const uploadYear = Number(toLocalMinute(uploadedAt, timeZone).slice(0, 4));
  const at = (year: number): Date => fromLocal({ year, month: row.month, day: row.day, hour, minute }, timeZone);

  const sameYear = at(uploadYear);
  const limit = uploadedAt.getTime() + 24 * 60 * 60 * 1000;
  return sameYear.getTime() > limit ? at(uploadYear - 1) : sameYear;
};
