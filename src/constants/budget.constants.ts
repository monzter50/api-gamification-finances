/**
 * Income Type Enum
 *
 * 'Credit Card' is intentionally absent: credit is debt, not income, and
 * counting it inflated the savings rate. Existing rows were migrated to
 * 'Transfer'.
 */
export type IncomeType = 'Debit Card' | 'Cash' | 'Vales' | 'Transfer' | 'Check' | 'Other';

export const INCOME_TYPES: IncomeType[] = ['Debit Card', 'Cash', 'Vales', 'Transfer', 'Check', 'Other'];

/**
 * Expense Type Enum
 */
export type ExpenseType = 'Fixed' | 'Variable';

export const EXPENSE_TYPES: ExpenseType[] = ['Fixed', 'Variable'];
