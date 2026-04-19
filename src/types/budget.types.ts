import { type Request } from 'express';
import { type IncomeItem, type ExpenseItem } from '@prisma/client';
import { type JWTPayload } from './index';
import { type IncomeType, type ExpenseType } from '../constants/budget.constants';

/**
 * Totals recomputed on every item-level mutation.
 *
 * Clients that just added/updated/removed a single item use this to refresh
 * the parent-level aggregate counters WITHOUT refetching the full budget.
 */
export interface BudgetTotals {
  totalIncome: number
  totalExpense: number
  netSavings: number
  savingsRate: number
}

/**
 * Response shape for item-level CREATE and UPDATE endpoints.
 *
 * - `item`:   the resource the caller actually created/updated (the REST-correct body).
 * - `totals`: recomputed parent-level aggregates so the UI does not need a second GET.
 *
 * See Option B design note.
 */
export interface IncomeItemMutationResult {
  item: IncomeItem
  totals: BudgetTotals
}

export interface ExpenseItemMutationResult {
  item: ExpenseItem
  totals: BudgetTotals
}

/**
 * Response shape for item-level DELETE endpoints.
 *
 * The item no longer exists, so only totals are returned.
 */
export interface ItemRemovalResult {
  totals: BudgetTotals
}

/**
 * Domain-level input shapes for creating/updating budget items.
 *
 * We use these INSTEAD of `Omit<IncomeItem, ...>` from Prisma because we want
 * the API contract to drive the shape, not the storage. In particular:
 *   - `accountId` is REQUIRED on income (planning income without a
 *     destination account is meaningless — see PR 1 design note).
 */
export interface IncomeItemInput {
  description: string
  amount: number
  type: IncomeType
  accountId: string
}

export interface ExpenseItemInput {
  description: string
  amount: number
  type: ExpenseType
}

/**
 * Budget Request Type
 * Extends Express Request for budget-specific operations
 * @template T - The type of the request body
 */
export interface BudgetRequest<T = any> extends Request {
  user?: JWTPayload // Added by authentication middleware
  body: T // Typed request body
}

/**
 * Create Budget Request Body
 */
export interface CreateBudgetBody {
  year: number
  month: number
  incomeItems?: Array<{
    description: string
    amount: number
    type: IncomeType
    accountId: string
  }>
  expenseItems?: Array<{
    description: string
    amount: number
    type: ExpenseType
  }>
}

/**
 * Update Budget Request Body
 */
export interface UpdateBudgetBody {
  year: number
  month: number
  incomeItems?: Array<{
    description: string
    amount: number
    type: IncomeType
    accountId: string
  }>
  expenseItems?: Array<{
    description: string
    amount: number
    type: ExpenseType
  }>
}

/**
 * Add Income Item Request Body
 */
export interface AddIncomeItemBody {
  description: string
  amount: number
  type: IncomeType
  accountId: string
}

/**
 * Add Expense Item Request Body
 */
export interface AddExpenseItemBody {
  description: string
  amount: number
  type: ExpenseType
}

/**
 * Update Income Items Request Body
 */
export interface UpdateIncomeItemsBody {
  incomeItems: Array<{
    description: string
    amount: number
    type: IncomeType
    accountId: string
  }>
}

/**
 * Update Expense Items Request Body
 */
export interface UpdateExpenseItemsBody {
  expenseItems: Array<{
    description: string
    amount: number
    type: ExpenseType
  }>
}

/**
 * Update Single Income Item Request Body
 */
export interface UpdateIncomeItemBody {
  description: string
  amount: number
  type: IncomeType
  accountId: string
}

/**
 * Update Single Expense Item Request Body
 */
export interface UpdateExpenseItemBody {
  description: string
  amount: number
  type: ExpenseType
}
