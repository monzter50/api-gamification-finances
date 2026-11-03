import { describe, it, expect } from 'vitest';
import { fingerprintOf, inferOccurredAt, normDescriptor } from '../../services/screenshotImport/fingerprint';
import { planInsertions } from '../../services/screenshotImport/reconcile';
import { budgetPeriodOf } from '../../services/budgetPeriod';
import { fromLocal, toLocalMinute } from '../../utils/localTime';

const base = {
  userId: 'user-1',
  accountId: 'acc-1',
  occurredAt: new Date('2026-10-23T15:10:00Z'), // 10:10 in Cancun
  amountCents: 5900,
  type: 'expense'
};

describe('local time (America/Cancun, UTC-5)', () => {
  it('converts wall time to UTC and back', () => {
    const at = fromLocal({ year: 2026, month: 10, day: 23, hour: 10, minute: 10 });
    expect(at.toISOString()).toBe('2026-10-23T15:10:00.000Z');
    expect(toLocalMinute(at)).toBe('2026-10-23T10:10');
  });
});

describe('normDescriptor / fingerprint', () => {
  it('case 7: descriptor variations give the same fingerprint', () => {
    expect(normDescriptor('Amazoncom inc amzn')).toBe('amazoncomincamzn');
    expect(normDescriptor('Amazon.com Inc AMZN')).toBe('amazoncomincamzn');
    const a = fingerprintOf({ ...base, descriptorNorm: normDescriptor('Amazoncom inc amzn') });
    const b = fingerprintOf({ ...base, descriptorNorm: normDescriptor('Amazon.com Inc AMZN') });
    expect(a).toBe(b);
  });

  it('strips accents and punctuation', () => {
    expect(normDescriptor('Café Ñandú *MX')).toBe('cafenandumx');
  });

  it('differs by minute, amount, type, account and user', () => {
    const fp = fingerprintOf({ ...base, descriptorNorm: 'oxxo' });
    expect(fingerprintOf({ ...base, descriptorNorm: 'oxxo', occurredAt: new Date('2026-10-23T15:11:00Z') })).not.toBe(fp);
    expect(fingerprintOf({ ...base, descriptorNorm: 'oxxo', amountCents: 5901 })).not.toBe(fp);
    expect(fingerprintOf({ ...base, descriptorNorm: 'oxxo', type: 'income' })).not.toBe(fp);
    expect(fingerprintOf({ ...base, descriptorNorm: 'oxxo', accountId: 'acc-2' })).not.toBe(fp);
    expect(fingerprintOf({ ...base, descriptorNorm: 'oxxo', userId: 'user-2' })).not.toBe(fp);
  });

  it('ignores seconds within the same minute', () => {
    const fp = fingerprintOf({ ...base, descriptorNorm: 'oxxo' });
    expect(fingerprintOf({ ...base, descriptorNorm: 'oxxo', occurredAt: new Date('2026-10-23T15:10:42Z') })).toBe(fp);
  });
});

describe('inferOccurredAt', () => {
  it('uses the upload year and keeps the local time', () => {
    const at = inferOccurredAt({ day: 23, month: 10, time: '10:10' }, new Date('2026-10-28T18:00:00Z'));
    expect(at.toISOString()).toBe('2026-10-23T15:10:00.000Z');
  });

  it('case 6: "28 de diciembre" uploaded on 3 Jan 2027 → 2026-12-28', () => {
    const at = inferOccurredAt({ day: 28, month: 12, time: '20:30' }, new Date('2027-01-03T17:00:00Z'));
    expect(toLocalMinute(at)).toBe('2026-12-28T20:30');
  });

  it('reads the upload year in local time (1 Jan 01:00 UTC is still 31 Dec in Cancun)', () => {
    const at = inferOccurredAt({ day: 31, month: 12, time: '18:00' }, new Date('2027-01-01T01:00:00Z'));
    expect(toLocalMinute(at)).toBe('2026-12-31T18:00');
  });

  it('tolerates one day of clock skew before rolling back a year', () => {
    const at = inferOccurredAt({ day: 29, month: 10, time: '09:00' }, new Date('2026-10-28T18:00:00Z'));
    expect(toLocalMinute(at)).toBe('2026-10-29T09:00');
  });
});

describe('budgetPeriodOf', () => {
  it('returns a 0-11 month in local time', () => {
    expect(budgetPeriodOf(new Date('2026-04-17T17:00:00Z'))).toEqual({ year: 2026, month: 3 });
  });

  it('a purchase at 21:00 on 31 Oct local belongs to October even though it is November in UTC', () => {
    expect(budgetPeriodOf(new Date('2026-11-01T02:00:00Z'))).toEqual({ year: 2026, month: 9 });
  });
});

describe('planInsertions (count reconciliation)', () => {
  const row = (fp: string, tag = fp) => ({ fingerprint: fp, tag });
  const none = new Map<string, number>();

  it('first import inserts every distinct row', () => {
    const { toInsert, skippedAsDuplicate } = planInsertions([{ rows: [row('A'), row('B')] }], none);
    expect(toInsert.map((r) => r.fingerprint)).toEqual(['A', 'B']);
    expect(skippedAsDuplicate).toBe(0);
  });

  it('case 1: identical re-import inserts 0', () => {
    const images = [{ rows: [row('A'), row('B')] }];
    const { toInsert, skippedAsDuplicate } = planInsertions(images, new Map([['A', 1], ['B', 1]]));
    expect(toInsert).toEqual([]);
    expect(skippedAsDuplicate).toBe(2);
  });

  it('case 3: overlapping screenshots (A,B,C + C,D) give 4 rows', () => {
    const { toInsert, skippedAsDuplicate } = planInsertions(
      [{ rows: [row('A'), row('B'), row('C')] }, { rows: [row('C'), row('D')] }],
      none
    );
    expect(toInsert.map((r) => r.fingerprint).sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(skippedAsDuplicate).toBe(1);
  });

  it('case 4: two identical rows in one image stay two; re-import adds 0', () => {
    const images = [{ rows: [row('OXXO', 'first'), row('OXXO', 'second')] }, { rows: [row('OXXO', 'overlap')] }];
    const first = planInsertions(images, none);
    expect(first.toInsert.map((r) => r.tag)).toEqual(['first', 'second']);

    const again = planInsertions(images, new Map([['OXXO', 2]]));
    expect(again.toInsert).toEqual([]);
  });

  it('case 5: partial new batch (A,B stored; B,C arrive) inserts only C', () => {
    const { toInsert } = planInsertions([{ rows: [row('B'), row('C')] }], new Map([['A', 1], ['B', 1]]));
    expect(toInsert.map((r) => r.fingerprint)).toEqual(['C']);
  });

  it('inserts only the missing copies when the DB has fewer than n', () => {
    const { toInsert } = planInsertions([{ rows: [row('X'), row('X'), row('X')] }], new Map([['X', 1]]));
    expect(toInsert).toHaveLength(2);
  });
});
