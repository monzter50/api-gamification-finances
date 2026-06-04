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
  date: string            // ISO YYYY-MM-DD, '' if unreadable
  amount: number
  vendor: string
  type: TransactionType
  description?: string
  paymentSource?: string  // "Payment Method / Card" → account mapping
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
  type: ExpenseItemType   // from the "Gastos Fijos / Gastos Variables" sections
}

export interface ParseResult {
  transactions: ParsedTransaction[]
  incomeItems: ParsedIncomeItem[]
  expenseItems: ParsedExpenseItem[]
  paymentSources: string[]
  counts: { transactions: number, incomeItems: number, expenseItems: number }
}

// ---- Confirm payload ----

/** Income item enriched with the user's chosen type + account. */
export interface ConfirmIncomeItem {
  description: string
  amount: number
  type: string            // one of INCOME_TYPES
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
  transactionIds: string[]
}
