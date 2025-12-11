import { Request } from 'express';
import { JWTPayload } from './index';
import { IncomeType } from '../models/Budget';

/**
 * Budget Request Type
 * Extends Express Request for budget-specific operations
 * @template T - The type of the request body
 */
export interface BudgetRequest<T = any> extends Request {
  user?: JWTPayload; // Added by authentication middleware
  body: T; // Typed request body
}

/**
 * Create Budget Request Body
 */
export interface CreateBudgetBody {
  year: number;
  month: number;
  incomeItems?: Array<{
    description: string;
    amount: number;
    type: IncomeType;
  }>;
  expenseItems?: Array<{
    description: string;
    amount: number;
  }>;
}

/**
 * Update Budget Request Body
 */
export interface UpdateBudgetBody {
  year: number;
  month: number;
  incomeItems?: Array<{
    description: string;
    amount: number;
    type: IncomeType;
  }>;
  expenseItems?: Array<{
    description: string;
    amount: number;
  }>;
}

/**
 * Add Income Item Request Body
 */
export interface AddIncomeItemBody {
  description: string;
  amount: number;
  type: IncomeType;
}

/**
 * Add Expense Item Request Body
 */
export interface AddExpenseItemBody {
  description: string;
  amount: number;
}

/**
 * Update Income Items Request Body
 */
export interface UpdateIncomeItemsBody {
  incomeItems: Array<{
    description: string;
    amount: number;
    type: IncomeType;
  }>;
}

/**
 * Update Expense Items Request Body
 */
export interface UpdateExpenseItemsBody {
  expenseItems: Array<{
    description: string;
    amount: number;
  }>;
}
