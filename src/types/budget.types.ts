import { type Request } from 'express';
import { type JWTPayload } from './index';
import { type IncomeType, type ExpenseType } from '../constants/budget.constants';

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
}

/**
 * Update Single Expense Item Request Body
 */
export interface UpdateExpenseItemBody {
  description: string
  amount: number
  type: ExpenseType
}
