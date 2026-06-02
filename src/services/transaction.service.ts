import { Prisma } from '@prisma/client';
import { transactionRepository, transactionIncludes, type EnhancedTransaction } from '../repositories/transaction.repository';
import { budgetRepository } from '../repositories/budget.repository';
import { accountRepository } from '../repositories/account.repository';
import prisma from '../config/database';
import { logger } from '../config/logger';

/** Fields needed to create one transaction row (shared by single + bulk create). */
export interface CreateTransactionInput {
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
}

/** Budget shape returned by budgetRepository.findById (includes income/expense items). */
type BudgetWithItems = NonNullable<Awaited<ReturnType<typeof budgetRepository.findById>>>;

/**
 * Transaction Service
 *
 * Owns the business rules around money movement:
 *  - Transactions are the only primitive that moves `Account.balance`.
 *  - IncomeItem / ExpenseItem are *planning* artifacts (forecast / limit).
 *  - Every create / update / delete is wrapped in `prisma.$transaction` so
 *    the row mutation and the balance delta either both commit or both roll
 *    back. There is no "transaction created but balance not updated" state.
 */
export class TransactionService {
    /**
     * Signed delta this transaction applies to its account's balance.
     *  - income  → +amount (credit)
     *  - expense → -amount (debit)
     * Anything else (e.g. 'savings' / 'transfer') is rejected — transfers
     * touch two accounts and need their own primitive, not this one.
     */
    private balanceDeltaForType(type: string, amount: number): number {
        if (type === 'income') return amount;
        if (type === 'expense') return -amount;
        throw new Error(
            `Unsupported transaction type "${type}" for balance update. Expected 'income' or 'expense'.`
        );
    }

    /**
     * Defense-in-depth: refuse to touch an account the caller doesn't own.
     * Cheap read; cost is dwarfed by the write it guards.
     */
    private async assertAccountBelongsToUser(accountId: string, userId: string): Promise<void> {
        const account = await accountRepository.findByIdAndUser(accountId, userId);
        if (!account) {
            throw new Error(`Account ${accountId} not found or does not belong to user`);
        }
    }

    /**
     * Create one transaction row + apply its balance delta, using the provided
     * Prisma client. Pass a `$transaction` client (`tx`) to compose this into a
     * larger atomic unit (e.g. bulk import); the row insert and the balance
     * update then commit/roll back with everything else in that transaction.
     *
     * `prefetchedBudget` lets a bulk caller validate/load the budget once and
     * reuse it across rows instead of re-reading it per row.
     *
     * NOTE: the budget-item limit reads (used/spent) query committed data, so
     * within a single bulk transaction multiple rows against the SAME
     * income/expense item don't see each other's not-yet-committed amounts.
     * Imported rows don't carry item ids today, so this isn't hit in practice;
     * revisit (pass `client` into the aggregation reads) if that changes.
     */
    private async createOne(
        client: Prisma.TransactionClient,
        userId: string,
        data: CreateTransactionInput,
        prefetchedBudget?: BudgetWithItems
    ): Promise<EnhancedTransaction> {
        // 1. Verify budget exists and belongs to user
        const budget = prefetchedBudget ?? await budgetRepository.findById(data.budgetId);
        if (!budget) {
            throw new Error('Budget not found');
        }
        if (budget.userId !== userId) {
            throw new Error('Unauthorized access to budget');
        }

        // 2. Verify account belongs to the same user (prevents cross-user balance writes)
        await this.assertAccountBelongsToUser(data.accountId, userId);

        // 3. Validate incomeItemId belongs to this budget and respects planned limits
        if (data.incomeItemId) {
            const incomeItem = budget.incomeItems.find(i => i.id === data.incomeItemId);
            if (!incomeItem) {
                throw new Error('Income item not found in this budget');
            }

            const usedAmount = await transactionRepository.getUsedForIncomeItem(data.incomeItemId);
            const remaining = incomeItem.amount - usedAmount;
            if (data.amount > remaining) {
                throw new Error(
                    `Transaction amount (${data.amount}) exceeds remaining income balance (${remaining.toFixed(2)}) for "${incomeItem.description}"`
                );
            }
        }

        // 4. Validate expenseItemId belongs to this budget and respects planned limits
        if (data.expenseItemId) {
            const expenseItem = budget.expenseItems.find(e => e.id === data.expenseItemId);
            if (!expenseItem) {
                throw new Error('Expense item not found in this budget');
            }

            const spentAmount = await transactionRepository.getSpentForExpenseItem(data.expenseItemId);
            const remaining = expenseItem.amount - spentAmount;
            if (data.amount > remaining) {
                throw new Error(
                    `Transaction amount (${data.amount}) exceeds remaining expense budget (${remaining.toFixed(2)}) for "${expenseItem.description}"`
                );
            }
        }

        // 5. Compute the balance delta up front so we fail fast on unsupported types
        const delta = this.balanceDeltaForType(data.type, Number(data.amount));

        // 6. Build the transaction row payload
        const txData: any = {
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

        // 7. Row insert + balance update on the supplied client
        const created = await client.transaction.create({
            data: txData,
            include: transactionIncludes
        });
        await client.account.update({
            where: { id: data.accountId },
            data: { balance: { increment: delta } }
        });

        logger.info(`Transaction created: ${created.id} (account ${data.accountId} delta ${delta})`);
        return created;
    }

    /**
     * Create a new transaction.
     * Atomically: insert the transaction row + credit/debit the account.
     */
    async createTransaction(userId: string, data: CreateTransactionInput): Promise<EnhancedTransaction> {
        return await prisma.$transaction(async (tx) => await this.createOne(tx, userId, data));
    }

    /**
     * Bulk-create transactions from a reviewed statement import.
     *
     * All-or-nothing: every row is created inside ONE `$transaction`, so either
     * the whole batch (rows + balance deltas) commits, or nothing does. Rows are
     * created SEQUENTIALLY (not in parallel) so account-balance increments and
     * any per-item aggregation apply in a deterministic order.
     *
     * The budget is validated/loaded once and reused across rows. Each row's
     * `accountId` may override the batch default (already merged by the caller).
     */
    async bulkCreateTransactions(
        userId: string,
        rows: CreateTransactionInput[]
    ): Promise<EnhancedTransaction[]> {
        if (rows.length === 0) {
            return [];
        }

        // Validate the shared budget once (all rows in an import target one budget).
        const budgetId = rows[0]!.budgetId;
        const budget = await budgetRepository.findById(budgetId);
        if (!budget) {
            throw new Error('Budget not found');
        }
        if (budget.userId !== userId) {
            throw new Error('Unauthorized access to budget');
        }

        const created = await prisma.$transaction(async (tx) => {
            const results: EnhancedTransaction[] = [];
            for (const row of rows) {
                // Reuse the prefetched budget when the row targets it (the common case).
                const prefetched = row.budgetId === budgetId ? budget : undefined;
                results.push(await this.createOne(tx, userId, row, prefetched));
            }
            return results;
        });

        logger.info(`Bulk import created ${created.length} transactions for user ${userId}`);
        return created;
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
     * Update a transaction.
     *
     * Balance strategy: reverse the old effect fully, then apply the new
     * effect fully. This covers every case (amount change, type flip,
     * account change, or any combination) with one uniform pair of updates,
     * and stays correct when the old and new accounts differ. All of it
     * commits atomically with the row update.
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
        // 1. Verify transaction exists and belongs to user
        const existing = await this.getTransactionById(id, userId);

        // 2. Re-validate budget-limit invariants if the caller changed anything that moves them
        const budgetId = existing.budgetId;

        if (budgetId && (data.incomeItemId !== undefined || data.expenseItemId !== undefined || data.amount !== undefined)) {
            const budget = await budgetRepository.findById(budgetId);
            if (!budget) throw new Error('Budget not found');

            const existingIncomeItemId = (existing as any).incomeItemId as string | null;
            const newIncomeItemId = data.incomeItemId !== undefined ? data.incomeItemId : existingIncomeItemId;
            if (newIncomeItemId) {
                const incomeItem = budget.incomeItems.find(i => i.id === newIncomeItemId);
                if (!incomeItem) throw new Error('Income item not found in this budget');

                const usedAmount = await transactionRepository.getUsedForIncomeItem(newIncomeItemId);
                // Exclude the current row's contribution since we're updating it in place
                const usedExcludingCurrent = newIncomeItemId === existingIncomeItemId
                    ? usedAmount - existing.amount
                    : usedAmount;
                const newAmount = data.amount ?? existing.amount;
                const remaining = incomeItem.amount - usedExcludingCurrent;

                if (newAmount > remaining) {
                    throw new Error(
                        `Transaction amount (${newAmount}) exceeds remaining income balance (${remaining.toFixed(2)}) for "${incomeItem.description}"`
                    );
                }
            }

            const existingExpenseItemId = (existing as any).expenseItemId as string | null;
            const newExpenseItemId = data.expenseItemId !== undefined ? data.expenseItemId : existingExpenseItemId;
            if (newExpenseItemId) {
                const expenseItem = budget.expenseItems.find(e => e.id === newExpenseItemId);
                if (!expenseItem) throw new Error('Expense item not found in this budget');

                const spentAmount = await transactionRepository.getSpentForExpenseItem(newExpenseItemId);
                const spentExcludingCurrent = newExpenseItemId === existingExpenseItemId
                    ? spentAmount - existing.amount
                    : spentAmount;
                const newAmount = data.amount ?? existing.amount;
                const remaining = expenseItem.amount - spentExcludingCurrent;

                if (newAmount > remaining) {
                    throw new Error(
                        `Transaction amount (${newAmount}) exceeds remaining expense budget (${remaining.toFixed(2)}) for "${expenseItem.description}"`
                    );
                }
            }
        }

        // 3. Resolve effective values for balance math
        const newAccountId = data.accountId ?? existing.accountId;
        const newType = data.type ?? existing.type;
        const newAmount = data.amount !== undefined ? Number(data.amount) : existing.amount;

        // 4. If the account is changing, make sure the target belongs to this user
        if (data.accountId && data.accountId !== existing.accountId) {
            await this.assertAccountBelongsToUser(data.accountId, userId);
        }

        // 5. Compute deltas: reverse old effect, apply new effect
        const oldDelta = this.balanceDeltaForType(existing.type, existing.amount);
        const newDelta = this.balanceDeltaForType(newType, newAmount);

        // 6. Build update payload (convert date string if present)
        const updateData: any = { ...data };
        if (data.date) updateData.date = new Date(data.date);

        // 7. Atomic: balance reversal on old account + balance apply on new account + row update
        const updated = await prisma.$transaction(async (tx) => {
            // Reverse old effect on old account
            await tx.account.update({
                where: { id: existing.accountId },
                data: { balance: { increment: -oldDelta } }
            });
            // Apply new effect on (possibly different) new account
            await tx.account.update({
                where: { id: newAccountId },
                data: { balance: { increment: newDelta } }
            });
            // Update the transaction row
            return await tx.transaction.update({
                where: { id },
                data: updateData,
                include: transactionIncludes
            });
        });

        logger.info(
            `Transaction updated: ${id} (reversed ${oldDelta} on ${existing.accountId}, applied ${newDelta} on ${newAccountId})`
        );
        return updated;
    }

    /**
     * Delete a transaction.
     * Atomically: remove the row + reverse its balance effect.
     */
    async deleteTransaction(id: string, userId: string): Promise<void> {
        const existing = await this.getTransactionById(id, userId);

        const delta = this.balanceDeltaForType(existing.type, existing.amount);

        await prisma.$transaction(async (tx) => {
            await tx.account.update({
                where: { id: existing.accountId },
                data: { balance: { increment: -delta } }
            });
            await tx.transaction.delete({
                where: { id }
            });
        });

        logger.info(`Transaction deleted: ${id} (reversed ${delta} on account ${existing.accountId})`);
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
