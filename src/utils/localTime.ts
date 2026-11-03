/**
 * Wall-clock helpers for a named IANA time zone, built on Intl (no dependency).
 *
 * The bank app shows local time (America/Cancun) with no year and no offset;
 * the DB stores UTC instants. These helpers convert between the two.
 */

/** Time zone of the user's bank screenshots. Cancun is UTC-5 all year (no DST since 2015). */
export const IMPORT_TIME_ZONE = 'America/Cancun';

export interface LocalParts {
  year: number
  month: number // 1-12
  day: number
  hour: number
  minute: number
}

const formatters = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (timeZone: string): Intl.DateTimeFormat => {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    formatters.set(timeZone, fmt);
  }
  return fmt;
};

/** The wall-clock reading of `instant` in `timeZone`. */
export const localParts = (instant: Date, timeZone: string = IMPORT_TIME_ZONE): LocalParts => {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute')
  };
};

/**
 * The UTC instant at which the clock in `timeZone` reads the given wall time.
 * `month` is 1-12. Two passes settle the offset, which covers DST zones too.
 */
export const fromLocal = (
  wall: LocalParts,
  timeZone: string = IMPORT_TIME_ZONE
): Date => {
  const target = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const seen = localParts(new Date(guess), timeZone);
    const seenAsUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
    guess += target - seenAsUtc;
  }
  return new Date(guess);
};

const pad = (n: number): string => String(n).padStart(2, '0');

/** "2026-10-23T10:10": the local minute of `instant`, the time part of a fingerprint. */
export const toLocalMinute = (instant: Date, timeZone: string = IMPORT_TIME_ZONE): string => {
  const p = localParts(instant, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
};
