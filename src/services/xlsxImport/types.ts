/**
 * Types for the Excel (.xlsx) import.
 *
 * The workbook maps to THREE app entities:
 *  - "Budget track" sheet → Transactions (the real expense ledger)
 *  - "Income"       sheet → budget IncomeItems  (planned income)
 *  - "Expenses"     sheet → budget ExpenseItems (planned expenses)
 *
 * `budgetId` / accounts / income-types are chosen by the user in the review UI,
 * so the parser only emits what the sheet actually contains.
 */
export type TransactionType = 'income' | 'expense';
export type ExpenseItemType = 'Fixed' | 'Variable';

/** A transaction parsed from the "Budget track" sheet. */
export interface ParsedTransaction {
  date: string // ISO YYYY-MM-DD, '' if unreadable
  amount: number
  vendor: string
  type: TransactionType
  description?: string
  paymentSource?: string // "Payment Method / Card" → account mapping
  category?: string // sheet "Category" → matched to an expense item (expenseItemId)
}

/** An income line item parsed from the "Income" sheet (type + account filled in UI). */
export interface ParsedIncomeItem {
  description: string
  amount: number
}

/** An expense line item parsed from the "Expenses" sheet. */
export interface ParsedExpenseItem {
  description: string
  amount: number
  type: ExpenseItemType // from the "Gastos Fijos / Gastos Variables" sections
}

export interface ParseResult {
  transactions: ParsedTransaction[]
  incomeItems: ParsedIncomeItem[]
  expenseItems: ParsedExpenseItem[]
  paymentSources: string[]
  /**
   * Transaction categories with no matching row in the workbook's "Expenses"
   * sheet. Surface these in the review step: unless the budget already has an
   * item with that name, those rows import without an expense item.
   */
  unmatchedCategories: string[]
  counts: { transactions: number, incomeItems: number, expenseItems: number }
}

// ---- Confirm payload ----

/** Income item enriched with the user's chosen type + account. */
export interface ConfirmIncomeItem {
  description: string
  amount: number
  type: string // one of INCOME_TYPES
  accountId: string
}

export interface ConfirmExpenseItem {
  description: string
  amount: number
  type: ExpenseItemType
}

export interface ConfirmXlsxPayload {
  budgetId: string
  /** Account for transactions without a paymentSource. */
  defaultAccountId: string
  /** "Payment Method / Card" → accountId (transactions). */
  accountMapping: Record<string, string>
  transactions: ParsedTransaction[]
  incomeItems: ConfirmIncomeItem[]
  expenseItems: ConfirmExpenseItem[]
}

export interface ConfirmXlsxResult {
  createdCount: { transactions: number, incomeItems: number, expenseItems: number }
  /** Items that already existed in the budget (same name) and were updated in place. */
  updatedCount: { incomeItems: number, expenseItems: number }
  /** Rows not created because an identical row was already imported. */
  skippedCount: { transactions: number }
  /** Categories that matched no expense item; their rows have no expenseItemId. */
  unmatchedCategories: string[]
  /** Ids of the transactions created by THIS call (skipped rows excluded). */
  transactionIds: string[]
}
