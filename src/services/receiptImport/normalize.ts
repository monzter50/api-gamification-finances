import { createHash } from 'node:crypto';
import type { AccountKind, DraftRow, ReviewReason, RowKind } from './types';
import type { VisionDateHeader, VisionRow } from './schema';

/**
 * Pure normalization: model transcription in, structured draft rows out.
 *
 * Deliberately free of I/O so the interesting rules — sign semantics, year
 * inference, de-duplication — are directly unit-testable without a model, a
 * database or an HTTP request in the loop.
 */

const SPANISH_MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12
};

/** Anything above this is a misread, not a purchase. */
const MAX_PLAUSIBLE_AMOUNT = 100_000_000;

/** Lowercase, strip accents, collapse whitespace — the vendor lookup key. */
export function toVendorKey (raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u2026|\.\.\./g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when the bank's UI cut the vendor name off. */
export function looksTruncated (raw: string): boolean {
  return /(…|\.\.\.)\s*$/.test(raw.trim());
}

/**
 * Parse a displayed amount. Assumes es-MX conventions: ',' groups thousands,
 * '.' is the decimal separator. Returns null when nothing usable is present.
 */
export function parseAmount (amountText: string): number | null {
  if (!amountText) { return null; }

  const digits = amountText.replace(/[^\d.,-]/g, '').replace(/,/g, '');
  if (digits === '' || digits === '-' || digits === '.') { return null; }

  const value = Number.parseFloat(digits);
  if (!Number.isFinite(value)) { return null; }

  const abs = Math.abs(value);
  if (abs > MAX_PLAUSIBLE_AMOUNT) { return null; }

  // Two decimal places: currency, not floating point.
  return Math.round(abs * 100) / 100;
}

/** '16:12 h' -> '16:12'. Returns null when no clock time is present. */
export function parseTime (timeText: string | null): string | null {
  if (!timeText) { return null; }
  const match = /(\d{1,2}):(\d{2})/.exec(timeText);
  if (!match?.[1] || !match[2]) { return null; }

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (hours > 23 || minutes > 59) { return null; }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export interface ResolvedDate {
  date: string
  yearInferred: boolean
}

/**
 * Resolve a Spanish date heading such as "22 de junio" to YYYY-MM-DD.
 *
 * The screen never shows a year, so we take the most recent occurrence at or
 * before `reference`. This is what makes a December statement imported in
 * January land in the right year instead of twelve months in the future.
 * An explicit 4-digit year in the heading always wins.
 */
export function resolveDateHeading (raw: string, reference: Date): ResolvedDate | null {
  if (!raw) { return null; }

  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const dayMatch = /(\d{1,2})/.exec(normalized);
  const monthMatch = /([a-z]+)/g;

  let month: number | undefined;
  let candidate: RegExpExecArray | null = monthMatch.exec(normalized);
  while (candidate !== null) {
    const word = candidate[1];
    if (word !== undefined && word in SPANISH_MONTHS) {
      month = SPANISH_MONTHS[word];
      break;
    }
    candidate = monthMatch.exec(normalized);
  }

  if (!dayMatch?.[1] || month === undefined) { return null; }

  const day = Number.parseInt(dayMatch[1], 10);
  if (day < 1 || day > 31) { return null; }

  const explicitYear = /\b(19|20)\d{2}\b/.exec(normalized);
  if (explicitYear?.[0]) {
    return { date: isoDate(Number.parseInt(explicitYear[0], 10), month, day), yearInferred: false };
  }

  let year = reference.getFullYear();
  // A statement row cannot be in the future; roll back a year if it would be.
  const asDate = new Date(year, month - 1, day, 23, 59, 59, 999);
  if (asDate.getTime() > reference.getTime()) { year -= 1; }

  return { date: isoDate(year, month, day), yearInferred: true };
}

function isoDate (year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * What a sign MEANS depends on the account it was shown for.
 *
 *  credit card view: '+' is a charge you owe, '-' is you paying the card off
 *                    (money moving between your own accounts — a transfer).
 *  debit view:       '+' is money in, '-' is money out.
 *
 * Getting this backwards double-counts card payments as spending, which is
 * why `accountKind` is a required input rather than something we guess.
 */
export function deriveKind (sign: '+' | '-', accountKind: AccountKind): RowKind {
  if (accountKind === 'credit') {
    return sign === '-' ? 'transfer' : 'expense';
  }
  return sign === '-' ? 'expense' : 'income';
}

/** Stable identity for a row, used to spot re-uploaded or overlapping images. */
export function buildExternalKey (parts: {
  date: string | null
  time: string | null
  vendorKey: string
  amountAbs: number
  signRaw: '+' | '-'
}): string {
  return createHash('sha1')
    .update([
      parts.date ?? 'nodate',
      parts.time ?? 'notime',
      parts.vendorKey,
      parts.amountAbs.toFixed(2),
      parts.signRaw
    ].join('|'))
    .digest('hex');
}

/**
 * Map row index -> resolved date by FORWARD-FILLING from each heading.
 *
 * A date heading in the app governs every row beneath it until the next
 * heading. Models are unreliable about saying so: qwen2.5-vl returns
 * `appliesToRows: [0, 1]` for a heading that actually covers five rows, which
 * would silently leave the rest dateless. Rather than lean harder on the
 * prompt, treat `appliesToRows` as a hint about where a heading STARTS and
 * derive the span here, where it is deterministic and testable.
 */
function buildDateIndex (
  headers: VisionDateHeader[],
  rowCount: number,
  reference: Date,
  fallbackHeading: string | null
): Map<number, ResolvedDate> {
  const index = new Map<number, ResolvedDate>();

  const effective = headers.length > 0
    ? headers
    : (fallbackHeading !== null ? [{ raw: fallbackHeading, appliesToRows: [0] }] : []);

  const anchors = effective
    .map((header, position) => {
      const resolved = resolveDateHeading(header.raw, reference);
      if (!resolved) { return null; }
      const indices = header.appliesToRows.filter((i) => Number.isInteger(i) && i >= 0);
      // No usable hint: fall back to the heading's own order of appearance.
      const startsAt = indices.length > 0 ? Math.min(...indices) : (position === 0 ? 0 : Number.MAX_SAFE_INTEGER);
      return { startsAt, resolved };
    })
    .filter((a): a is { startsAt: number, resolved: ResolvedDate } => a !== null)
    .sort((a, b) => a.startsAt - b.startsAt);

  if (anchors.length === 0) { return index; }

  // The first heading governs from row 0, even if the model claimed otherwise
  // -- rows cannot appear above the first date in the list.
  const first = anchors[0];
  if (first !== undefined) { first.startsAt = 0; }

  let cursor = 0;
  for (let row = 0; row < rowCount; row += 1) {
    while (cursor + 1 < anchors.length) {
      const next = anchors[cursor + 1];
      if (next !== undefined && next.startsAt <= row) { cursor += 1; } else { break; }
    }
    const active = anchors[cursor];
    if (active !== undefined) { index.set(row, active.resolved); }
  }

  return index;
}

export interface NormalizeResult {
  rows: DraftRow[]
  duplicatesInBatch: number
  warnings: string[]
}

export function normalizeRows (
  visionRows: VisionRow[],
  dateHeaders: VisionDateHeader[],
  options: { accountKind: AccountKind, referenceDate: Date, primaryDateHeading?: string | null }
): NormalizeResult {
  const fallbackHeading = options.primaryDateHeading ?? null;
  const dateIndex = buildDateIndex(dateHeaders, visionRows.length, options.referenceDate, fallbackHeading);
  const warnings: string[] = [];

  const sawHeading = dateHeaders.length > 0 || fallbackHeading !== null;
  if (sawHeading && dateIndex.size === 0) {
    warnings.push('A date heading was detected but could not be parsed; rows have no date.');
  }
  if (!sawHeading) {
    warnings.push('No date heading was detected in the image; rows have no date.');
  }

  const seen = new Set<string>();
  const rows: DraftRow[] = [];
  let duplicatesInBatch = 0;

  visionRows.forEach((raw, index) => {
    const vendorRaw = raw.vendorRaw.trim();
    if (vendorRaw === '') { return; }

    const reviewReasons: ReviewReason[] = [];

    const amountAbs = parseAmount(raw.amountText);
    if (amountAbs === null) { reviewReasons.push('unreadable_amount'); }

    const truncated = raw.truncated || looksTruncated(vendorRaw);
    if (truncated) { reviewReasons.push('truncated_vendor'); }

    const resolved = dateIndex.get(index) ?? null;
    if (!resolved) { reviewReasons.push('missing_date'); }
    if (resolved?.yearInferred === true) { reviewReasons.push('year_inferred'); }

    const time = parseTime(raw.timeText);
    if (time === null) { reviewReasons.push('missing_time'); }

    const signRaw = raw.signText;
    const kind = deriveKind(signRaw, options.accountKind);
    if (kind === 'transfer') { reviewReasons.push('transfer_detected'); }

    const date = resolved?.date ?? null;
    const amount = amountAbs ?? 0;

    const externalKey = buildExternalKey({ date, time, vendorKey: toVendorKey(vendorRaw), amountAbs: amount, signRaw });
    if (seen.has(externalKey)) {
      duplicatesInBatch += 1;
      return;
    }
    seen.add(externalKey);

    rows.push({
      vendorRaw,
      vendorKey: toVendorKey(vendorRaw),
      truncated,
      amountAbs: amount,
      signRaw,
      amountText: raw.amountText,
      kind,
      occurredAt: date !== null ? `${date}T${time ?? '00:00'}:00` : null,
      date,
      time,
      yearInferred: resolved?.yearInferred ?? false,
      method: raw.subtitle !== null ? raw.subtitle.trim() : null,
      externalKey,
      needsReview: reviewReasons.length > 0,
      reviewReasons
    });
  });

  if (duplicatesInBatch > 0) {
    warnings.push(`${duplicatesInBatch} duplicate row(s) were removed — overlapping screenshots.`);
  }

  return { rows, duplicatesInBatch, warnings };
}
