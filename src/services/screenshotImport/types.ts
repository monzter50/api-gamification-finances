/**
 * Screenshot import contract. OCR happens in the client (Claude reading the
 * BBVA "Movimientos" screenshots through the finances MCP server); the API
 * receives the parsed rows grouped by the image they came from, plus each
 * image's SHA-256 so the same file is never imported twice.
 */

export type ScreenshotTxType = 'income' | 'expense';

/** One row as it reads on screen. No year: the screenshot doesn't show it. */
export interface ScreenshotRow {
  day: number // 1-31, from the day header ("23 de octubre")
  month: number // 1-12
  time: string // "HH:mm", local time
  rawDescriptor: string // merchant text as shown: "Stripe *unicef mx"
  amount: number // positive, decimal units (pesos)
  type: ScreenshotTxType
  description?: string // the user's own note; never the category
}

export interface ScreenshotImage {
  sha256: string // hex, of the image file bytes
  rows: ScreenshotRow[]
}

export interface ScreenshotImportPayload {
  accountId: string
  images: ScreenshotImage[]
}

export interface ScreenshotImportResult {
  batchId: string
  inserted: number
  /** Rows not inserted: already in the ledger or repeated by overlapping screenshots. */
  skippedAsDuplicate: number
  /** Images skipped whole because that exact file was imported before. */
  skippedImages: number
  /** Inserted rows with no budget for their month (budgetId left null). */
  unbudgeted: number
  transactionIds: string[]
}
