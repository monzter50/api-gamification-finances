/**
 * Types for the bank-screenshot import.
 *
 * This endpoint is READ-ONLY: it turns an image into structured draft rows and
 * returns them. Nothing is written. Linking rows to a budget, resolving
 * accounts and creating Transactions happens in a later confirm step (not yet
 * built) that reuses the existing xlsx confirm pipeline.
 */

/** How the source account treats signs. Decides what a minus means. */
export type AccountKind = 'credit' | 'debit';

/**
 * What a row represents once the sign has been interpreted.
 * 'transfer' covers card payments (e.g. "Bmovil.pago tdc") which move money
 * between the user's own accounts and must never be booked as spending.
 */
export type RowKind = 'income' | 'expense' | 'transfer';

/** Why a row was flagged for human attention. */
export type ReviewReason =
  | 'truncated_vendor'
  | 'transfer_detected'
  | 'year_inferred'
  | 'unreadable_amount'
  | 'missing_date'
  | 'missing_time';

/** A single normalized draft row. */
export interface DraftRow {
  /** Bank descriptor exactly as printed, e.g. "Gasol arco kabah". */
  vendorRaw: string
  /** Lookup key: lowercased, accent-stripped, whitespace-collapsed. */
  vendorKey: string
  /** True when the app's UI cut the name off — the tail is unrecoverable. */
  truncated: boolean

  /** Absolute value. Sign lives in `signRaw`, meaning lives in `kind`. */
  amountAbs: number
  /** The sign as printed: '+' or '-'. */
  signRaw: '+' | '-'
  /** The raw amount string, kept for audit when a parse looks wrong. */
  amountText: string
  kind: RowKind

  /** ISO-8601 local timestamp, or null when the date could not be resolved. */
  occurredAt: string | null
  /** Date component, YYYY-MM-DD. */
  date: string | null
  /** 24h HH:mm as printed, when the row showed one. */
  time: string | null
  /** True when the year came from inference, not from the screen. */
  yearInferred: boolean

  /** The card subtitle, e.g. "Pago con tarjeta". */
  method: string | null

  /** Stable hash for de-duplicating re-uploaded / overlapping screenshots. */
  externalKey: string

  needsReview: boolean
  reviewReasons: ReviewReason[]
}

export interface ParseImageOptions {
  /** Decides sign semantics. Defaults to 'credit'. */
  accountKind: AccountKind
  /** Anchor for year inference. Defaults to now. */
  referenceDate: Date
}

export interface ParseImageResult {
  rows: DraftRow[]
  counts: {
    rows: number
    needsReview: number
    transfers: number
    duplicatesInBatch: number
  }
  source: {
    model: string
    imagesProcessed: number
    accountKind: AccountKind
    latencyMs: number
  }
  /** Non-fatal problems worth showing in the review UI. */
  warnings: string[]
}
