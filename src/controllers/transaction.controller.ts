import type { Response } from 'express';
import {
    type TransactionRequest,
    type CreateTransactionBody,
    type UpdateTransactionBody,
    type TransactionQueryParams
} from '../types/transaction.types';
import { transactionService } from '../services/transaction.service';
import { logger } from '../config/logger';

/**
 * Transaction Controller
 * Handles HTTP requests for transaction operations
 */
export class TransactionController {
    /**
     * GET /api/transactions
     * Get all transactions for authenticated user (paginated)
     */
    async getAllTransactions(req: TransactionRequest, res: Response): Promise<void> {
        try {
            const userId = req.user!.userId;
            const query = req.query as unknown as TransactionQueryParams;

            const page = query.page ? parseInt(query.page) : 1;
            const limit = query.limit ? parseInt(query.limit) : 10;

            const filters: { type?: string; budgetId?: string; startDate?: string; endDate?: string } = {};
            if (query.type) filters.type = query.type;
            if (query.budgetId) filters.budgetId = query.budgetId;
            if (query.startDate) filters.startDate = query.startDate;
            if (query.endDate) filters.endDate = query.endDate;

            const result = await transactionService.getTransactions(
                userId,
                filters,
                page,
                limit
            );

            res.status(200).json({
                success: true,
                data: result.data,
                pagination: {
                    page: result.page,
                    limit,
                    total: result.total,
                    pages: result.totalPages
                },
                totals: result.totals,
                message: 'Transactions retrieved successfully'
            });
        } catch (error) {
            logger.error('Error getting transactions:', error);
            res.status(500).json({
                success: false,
                error: 'Error retrieving transactions',
                statusCode: 500
            });
        }
    }

    /**
     * GET /api/transactions/summary
     * Get financial summary for user
     */
    async getFinancialSummary(req: TransactionRequest, res: Response): Promise<void> {
        try {
            const userId = req.user!.userId;
            const summary = await transactionService.getFinancialSummary(userId);

            res.status(200).json({
                success: true,
                data: summary,
                message: 'Financial summary retrieved successfully'
            });
        } catch (error) {
            logger.error('Error getting financial summary:', error);
            res.status(500).json({
                success: false,
                error: 'Error retrieving financial summary',
                statusCode: 500
            });
        }
    }

    /**
     * GET /api/transactions/monthly/:year/:month
     * Get monthly summary
     */
    async getMonthlySummary(req: TransactionRequest, res: Response): Promise<void> {
        try {
            const userId = req.user!.userId;
            const year = parseInt(req.params.year!);
            const month = parseInt(req.params.month!);

            const summary = await transactionService.getMonthlySummary(userId, year, month);

            res.status(200).json({
                success: true,
                data: summary,
                message: 'Monthly summary retrieved successfully'
            });
        } catch (error) {
            logger.error('Error getting monthly summary:', error);
            res.status(500).json({
                success: false,
                error: 'Error retrieving monthly summary',
                statusCode: 500
            });
        }
    }

    /**
     * GET /api/transactions/budget/:budgetId/balance
     * Get budget balance breakdown
     */
    async getBudgetBalance(req: TransactionRequest, res: Response): Promise<void> {
        try {
            const userId = req.user!.userId;
            const budgetId = req.params.budgetId!;

            const balance = await transactionService.getBudgetBalance(budgetId, userId);

            res.status(200).json({
                success: true,
                data: balance,
                message: 'Budget balance retrieved successfully'
            });
        } catch (error) {
            logger.error('Error getting budget balance:', error);

            const errorMessage = (error as Error).message;
            if (errorMessage === 'Budget not found') {
                res.status(404).json({
                    success: false,
                    error: 'Budget not found',
                    statusCode: 404
                });
                return;
            }

            if (errorMessage === 'Unauthorized access to budget') {
                res.status(403).json({
                    success: false,
                    error: 'Unauthorized access to budget',
                    statusCode: 403
                });
                return;
            }

            res.status(500).json({
                success: false,
                error: 'Error retrieving budget balance',
                statusCode: 500
            });
        }
    }

    /**
     * GET /api/transactions/:id
     * Get transaction by ID
     */
    async getTransactionById(req: TransactionRequest, res: Response): Promise<void> {
        try {
            const id = req.params.id!;
            const userId = req.user!.userId;

            const transaction = await transactionService.getTransactionById(id, userId);

            res.status(200).json({
                success: true,
                data: transaction,
                message: 'Transaction retrieved successfully'
            });
        } catch (error) {
            logger.error('Error getting transaction:', error);

            if ((error as Error).message === 'Transaction not found') {
                res.status(404).json({
                    success: false,
                    error: 'Transaction not found',
                    statusCode: 404
                });
                return;
            }

            res.status(500).json({
                success: false,
                error: 'Error retrieving transaction',
                statusCode: 500
            });
        }
    }

    /**
     * POST /api/transactions
     * Create new transaction
     */
    async createTransaction(req: TransactionRequest<CreateTransactionBody>, res: Response): Promise<void> {
        try {
            const userId = req.user!.userId;

            const transaction = await transactionService.createTransaction(userId, req.body);

            res.status(201).json({
                success: true,
                data: transaction,
                message: 'Transaction created successfully'
            });
        } catch (error) {
            logger.error('Error creating transaction:', error);

            const errorMessage = (error as Error).message;

            if (errorMessage === 'Budget not found') {
                res.status(404).json({
                    success: false,
                    error: 'Budget not found',
                    statusCode: 404
                });
                return;
            }

            if (errorMessage === 'Unauthorized access to budget') {
                res.status(403).json({
                    success: false,
                    error: 'Unauthorized access to budget',
                    statusCode: 403
                });
                return;
            }

            if (
                errorMessage.includes('not found in this budget') ||
                errorMessage.includes('exceeds remaining')
            ) {
                res.status(400).json({
                    success: false,
                    error: errorMessage,
                    statusCode: 400
                });
                return;
            }

            res.status(500).json({
                success: false,
                error: 'Error creating transaction',
                statusCode: 500
            });
        }
    }

    /**
     * PUT /api/transactions/:id
     * Update transaction
     */
    async updateTransaction(req: TransactionRequest<UpdateTransactionBody>, res: Response): Promise<void> {
        try {
            const id = req.params.id!;
            const userId = req.user!.userId;

            const transaction = await transactionService.updateTransaction(id, userId, req.body);

            res.status(200).json({
                success: true,
                data: transaction,
                message: 'Transaction updated successfully'
            });
        } catch (error) {
            logger.error('Error updating transaction:', error);

            const errorMessage = (error as Error).message;

            if (errorMessage === 'Transaction not found') {
                res.status(404).json({
                    success: false,
                    error: 'Transaction not found',
                    statusCode: 404
                });
                return;
            }

            if (errorMessage === 'Budget not found') {
                res.status(404).json({
                    success: false,
                    error: 'Budget not found',
                    statusCode: 404
                });
                return;
            }

            if (
                errorMessage.includes('not found in this budget') ||
                errorMessage.includes('exceeds remaining')
            ) {
                res.status(400).json({
                    success: false,
                    error: errorMessage,
                    statusCode: 400
                });
                return;
            }

            res.status(500).json({
                success: false,
                error: 'Error updating transaction',
                statusCode: 500
            });
        }
    }

    /**
     * DELETE /api/transactions/:id
     * Delete transaction (restores budget amount)
     */
    async deleteTransaction(req: TransactionRequest, res: Response): Promise<void> {
        try {
            const id = req.params.id!;
            const userId = req.user!.userId;

            await transactionService.deleteTransaction(id, userId);

            res.status(200).json({
                success: true,
                message: 'Transaction deleted successfully'
            });
        } catch (error) {
            logger.error('Error deleting transaction:', error);

            if ((error as Error).message === 'Transaction not found') {
                res.status(404).json({
                    success: false,
                    error: 'Transaction not found',
                    statusCode: 404
                });
                return;
            }

            res.status(500).json({
                success: false,
                error: 'Error deleting transaction',
                statusCode: 500
            });
        }
    }
}

// Export singleton instance
export const transactionController = new TransactionController();
