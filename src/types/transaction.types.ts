import { type Request } from 'express';
import { type JWTPayload } from './index';

/**
 * Transaction Request Type
 * Extends Express Request for transaction-specific operations
 */
export interface TransactionRequest<T = any> extends Request {
    user?: JWTPayload
    body: T
}

/**
 * Create Transaction Request Body
 */
export interface CreateTransactionBody {
    budgetId: string
    date: string // ISO date string
    amount: number
    vendor: string
    type: 'income' | 'expense'
    accountId: string
    description?: string
    incomeItemId?: string
    expenseItemId?: string
    installmentCurrent?: number
    installmentTotal?: number
    installmentOriginal?: number
}

/**
 * Update Transaction Request Body
 */
export interface UpdateTransactionBody {
    date?: string
    amount?: number
    vendor?: string
    type?: 'income' | 'expense'
    accountId?: string
    description?: string
    incomeItemId?: string | null
    expenseItemId?: string | null
    installmentCurrent?: number
    installmentTotal?: number
    installmentOriginal?: number
}

/**
 * Transaction Query Params
 */
export interface TransactionQueryParams {
    type?: 'income' | 'expense'
    budgetId?: string
    startDate?: string
    endDate?: string
    page?: string
    limit?: string
}
