import { transactionRepository, type EnhancedTransaction } from '../repositories/transaction.repository';
import { budgetRepository } from '../repositories/budget.repository';
import { logger } from '../config/logger';

/**
 * Transaction Service
 * Handles business logic for transaction operations
 */
export class TransactionService {
    /**
     * Create a new transaction
     * Validates budget ownership and enforces budget limits
     */
    async createTransaction(userId: string, data: {
        budgetId: string
        date: string
        amount: number
        vendor: string
        type: string
        accountId: string
        description?: string
        incomeItemId?: string
        expenseItemId?: string
        installmentCurrent?: number
        installmentTotal?: number
        installmentOriginal?: number
    }): Promise<EnhancedTransaction> {
        // 1. Verify budget exists and belongs to user
        const budget = await budgetRepository.findById(data.budgetId);
        if (!budget) {
            throw new Error('Budget not found');
        }
        if (budget.userId !== userId) {
            throw new Error('Unauthorized access to budget');
        }

        // 2. Validate incomeItemId belongs to this budget
        if (data.incomeItemId) {
            const incomeItem = budget.incomeItems.find(i => i.id === data.incomeItemId);
            if (!incomeItem) {
                throw new Error('Income item not found in this budget');
            }

            // Check remaining balance on the income item
            const usedAmount = await transactionRepository.getUsedForIncomeItem(data.incomeItemId);
            const remaining = incomeItem.amount - usedAmount;
            if (data.amount > remaining) {
                throw new Error(
                    `Transaction amount (${data.amount}) exceeds remaining income balance (${remaining.toFixed(2)}) for "${incomeItem.description}"`
                );
            }
        }

        // 3. Validate expenseItemId belongs to this budget
        if (data.expenseItemId) {
            const expenseItem = budget.expenseItems.find(e => e.id === data.expenseItemId);
            if (!expenseItem) {
                throw new Error('Expense item not found in this budget');
            }

            // Check remaining budget for this expense category
            const spentAmount = await transactionRepository.getSpentForExpenseItem(data.expenseItemId);
            const remaining = expenseItem.amount - spentAmount;
            if (data.amount > remaining) {
                throw new Error(
                    `Transaction amount (${data.amount}) exceeds remaining expense budget (${remaining.toFixed(2)}) for "${expenseItem.description}"`
                );
            }
        }

        // 4. Build transaction data, only including defined optional fields
        const txData: Parameters<typeof transactionRepository.createTransaction>[0] = {
            userId,
            budgetId: data.budgetId,
            date: new Date(data.date),
            amount: Number(data.amount),
            vendor: data.vendor,
            type: data.type,
            accountId: data.accountId
        };

        if (data.description !== undefined) txData.description = data.description;
        if (data.incomeItemId !== undefined) txData.incomeItemId = data.incomeItemId;
        if (data.expenseItemId !== undefined) txData.expenseItemId = data.expenseItemId;
        if (data.installmentCurrent !== undefined) txData.installmentCurrent = data.installmentCurrent;
        if (data.installmentTotal !== undefined) txData.installmentTotal = data.installmentTotal;
        if (data.installmentOriginal !== undefined) txData.installmentOriginal = data.installmentOriginal;

        const transaction = await transactionRepository.createTransaction(txData);

        logger.info(`Transaction created: ${transaction.id} for budget ${data.budgetId}`);
        return transaction;
    }

    /**
     * Get paginated transactions for a user
     */
    async getTransactions(
        userId: string,
        filters: {
            type?: string
            budgetId?: string
            startDate?: string
            endDate?: string
        } = {},
        page: number = 1,
        limit: number = 10
    ) {
        const parsedFilters: {
            type?: string
            budgetId?: string
            startDate?: Date
            endDate?: Date
        } = {};

        if (filters.type) parsedFilters.type = filters.type;
        if (filters.budgetId) parsedFilters.budgetId = filters.budgetId;
        if (filters.startDate) parsedFilters.startDate = new Date(filters.startDate);
        if (filters.endDate) parsedFilters.endDate = new Date(filters.endDate);

        return await transactionRepository.findByUserPaginated(userId, parsedFilters, page, limit);
    }

    /**
     * Get a single transaction by ID
     */
    async getTransactionById(id: string, userId: string): Promise<EnhancedTransaction> {
        const transaction = await transactionRepository.findByIdAndUser(id, userId);

        if (!transaction) {
            throw new Error('Transaction not found');
        }

        return transaction;
    }

    /**
     * Update a transaction
     */
    async updateTransaction(
        id: string,
        userId: string,
        data: {
            date?: string
            amount?: number
            vendor?: string
            type?: string
            accountId?: string
            description?: string
            incomeItemId?: string | null
            expenseItemId?: string | null
            installmentCurrent?: number
            installmentTotal?: number
            installmentOriginal?: number
        }
    ): Promise<EnhancedTransaction> {
        // Verify transaction exists and belongs to user
        const existing = await this.getTransactionById(id, userId);

        // If changing budget-related items, re-validate
        const budgetId = existing.budgetId;

        if (budgetId && (data.incomeItemId !== undefined || data.expenseItemId !== undefined || data.amount !== undefined)) {
            const budget = await budgetRepository.findById(budgetId);
            if (!budget) throw new Error('Budget not found');

            // Validate income item if being set
            const existingIncomeItemId = (existing as any).incomeItemId as string | null;
            const newIncomeItemId = data.incomeItemId !== undefined ? data.incomeItemId : existingIncomeItemId;
            if (newIncomeItemId) {
                const incomeItem = budget.incomeItems.find(i => i.id === newIncomeItemId);
                if (!incomeItem) throw new Error('Income item not found in this budget');

                const usedAmount = await transactionRepository.getUsedForIncomeItem(newIncomeItemId);
                // Subtract the current transaction's contribution since we're updating
                const usedExcludingCurrent = usedAmount - existing.amount;
                const newAmount = data.amount ?? existing.amount;
                const remaining = incomeItem.amount - usedExcludingCurrent;

                if (newAmount > remaining) {
                    throw new Error(
                        `Transaction amount (${newAmount}) exceeds remaining income balance (${remaining.toFixed(2)}) for "${incomeItem.description}"`
                    );
                }
            }

            // Validate expense item if being set
            const existingExpenseItemId = (existing as any).expenseItemId as string | null;
            const newExpenseItemId = data.expenseItemId !== undefined ? data.expenseItemId : existingExpenseItemId;
            if (newExpenseItemId) {
                const expenseItem = budget.expenseItems.find(e => e.id === newExpenseItemId);
                if (!expenseItem) throw new Error('Expense item not found in this budget');

                const spentAmount = await transactionRepository.getSpentForExpenseItem(newExpenseItemId);
                const spentExcludingCurrent = spentAmount - existing.amount;
                const newAmount = data.amount ?? existing.amount;
                const remaining = expenseItem.amount - spentExcludingCurrent;

                if (newAmount > remaining) {
                    throw new Error(
                        `Transaction amount (${newAmount}) exceeds remaining expense budget (${remaining.toFixed(2)}) for "${expenseItem.description}"`
                    );
                }
            }
        }

        const updateData: any = { ...data };
        if (data.date) updateData.date = new Date(data.date);

        const updated = await transactionRepository.updateByIdAndUser(id, userId, updateData);

        if (!updated) {
            throw new Error('Failed to update transaction');
        }

        logger.info(`Transaction updated: ${id}`);
        return updated;
    }

    /**
     * Delete a transaction
     * This effectively "restores" the budget amount
     */
    async deleteTransaction(id: string, userId: string): Promise<void> {
        // Verify transaction exists and belongs to user
        await this.getTransactionById(id, userId);

        const deleted = await transactionRepository.deleteByIdAndUser(id, userId);

        if (!deleted) {
            throw new Error('Failed to delete transaction');
        }

        logger.info(`Transaction deleted: ${id} (budget amount restored)`);
    }

    /**
     * Get financial summary for user
     */
    async getFinancialSummary(userId: string) {
        return await transactionRepository.getTransactionSummary(userId);
    }

    /**
     * Get monthly summary for user
     */
    async getMonthlySummary(userId: string, year: number, month: number) {
        const summary = await transactionRepository.getTransactionSummary(userId, year, month);

        return {
            year,
            month,
            ...summary
        };
    }

    /**
     * Get budget balance info — shows how much is spent vs budgeted
     */
    async getBudgetBalance(budgetId: string, userId: string) {
        // Verify budget belongs to user
        const budget = await budgetRepository.findById(budgetId);
        if (!budget) throw new Error('Budget not found');
        if (budget.userId !== userId) throw new Error('Unauthorized access to budget');

        // For each expense item, calculate spent vs budgeted
        const expenseBreakdown = await Promise.all(
            budget.expenseItems.map(async (item) => {
                const spent = await transactionRepository.getSpentForExpenseItem(item.id);
                return {
                    id: item.id,
                    description: item.description,
                    budgeted: item.amount,
                    spent,
                    remaining: item.amount - spent,
                    percentUsed: item.amount > 0 ? (spent / item.amount) * 100 : 0
                };
            })
        );

        // For each income item, calculate used vs available
        const incomeBreakdown = await Promise.all(
            budget.incomeItems.map(async (item) => {
                const used = await transactionRepository.getUsedForIncomeItem(item.id);
                return {
                    id: item.id,
                    description: item.description,
                    available: item.amount,
                    used,
                    remaining: item.amount - used,
                    percentUsed: item.amount > 0 ? (used / item.amount) * 100 : 0
                };
            })
        );

        return {
            budgetId,
            totalBudgetedIncome: budget.totalIncome,
            totalBudgetedExpense: budget.totalExpense,
            incomeBreakdown,
            expenseBreakdown
        };
    }
}

// Export singleton instance
export const transactionService = new TransactionService();
