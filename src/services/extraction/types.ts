/**
 * Statement-extraction contract.
 *
 * This is the single source of truth for the shape produced by ANY extractor
 * (mock now, Claude later). It is intentionally a strict subset of the
 * transaction-create fields that can be read FROM an image — `budgetId` and
 * `accountId` are NOT here: the user picks those in the review UI.
 */

/** One transaction extracted from a statement image. */
export interface ExtractedTransaction {
  /** ISO 8601 (YYYY-MM-DD). Empty string when the date was unreadable — the review UI must force a fix. */
  date: string
  /** Absolute value, always > 0. Sign/direction is carried by `type`. */
  amount: number
  /** Merchant / payer name as printed. */
  vendor: string
  /** Direction inferred from the row (debit→expense, credit→income). */
  type: 'income' | 'expense'
  /** Optional memo/reference text from the row. */
  description?: string
  /** How sure the extractor is this row was read correctly (review-only, not persisted). */
  confidence: 'high' | 'medium' | 'low'
  /** Raw row text as it appeared in the image (review-only, helps the user verify). */
  sourceText: string
}

/** Wrapper the extractor returns — leaves room for image-level hints. */
export interface ExtractionResult {
  transactions: ExtractedTransaction[]
  /** ISO currency code if the statement makes it clear; the chosen account is the source of truth. */
  currencyHint?: string
}

/**
 * Swappable extractor. Implementations: MockTransactionExtractor (now),
 * ClaudeTransactionExtractor (when an ANTHROPIC_API_KEY is available).
 */
export interface TransactionExtractor {
  readonly source: 'mock' | 'claude'
  extract: (image: Buffer, mimeType: string) => Promise<ExtractionResult>
}
