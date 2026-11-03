import { type Prisma } from '@prisma/client';
import { transactionRepository, transactionIncludes, type EnhancedTransaction } from '../repositories/transaction.repository';
import { budgetRepository } from '../repositories/budget.repository';
import { accountRepository } from '../repositories/account.repository';
import prisma from '../config/database';
import { logger } from '../config/logger';
import { toCents, fromCents } from '../utils/money';
import { statusOf, balanceDeltaCents, balanceIncrement } from './ledgerRules';
import {
  BudgetNotFoundError,
  IncomeLimitExceededError,
  InvalidAccountReferenceError,
  InvalidBudgetItemReferenceError,
  TransactionNotFoundError
} from '../errors/DomainErrors';

/**
 * Transaction Service
 *
 * Owns the business rules around money movement:
 *  - Transactions are the only primitive that moves `Account.balance`.
 *  - IncomeItem / ExpenseItem are *planning* artifacts (forecast / limit).
 *  - Every create / update / delete is wrapped in `prisma.$transaction` so
 *    the row mutation and the balance delta either both commit or both roll
 *    back. There is no "transaction created but balance not updated" state.
 *  - Overspending an ExpenseItem is NOT an error. The ledger records what
 *    actually happened; `getBudgetBalance` reports each line's `status`.
 *  - All money math runs in integer cents (see `utils/money`).
 */
export class TransactionService {
  /**
     * Defense-in-depth: refuse to touch an account the caller doesn't own.
     * Cheap read; cost is dwarfed by the write it guards.
     */
  private async assertAccountBelongsToUser (accountId: string, userId: string): Promise<void> {
    const account = await accountRepository.findByIdAndUser(accountId, userId);
    if (!account) {
      throw new InvalidAccountReferenceError(accountId);
    }
  }

  /**
     * Create a new transaction.
     * Atomically: insert the transaction row + credit/debit the account.
     */
  async createTransaction (userId: string, data: {
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
    // 1. Verify budget exists and belongs to user (not owned ≡ not found → 404)
    const budget = await budgetRepository.findByIdAndUser(data.budgetId, userId);
    if (!budget) {
      throw new BudgetNotFoundError();
    }

    // 2. Verify account belongs to the same user (prevents cross-user balance writes)
    await this.assertAccountBelongsToUser(data.accountId, userId);

    const amountCents = toCents(data.amount);

    // 3. Validate incomeItemId belongs to this budget and respects planned limits
    if (data.incomeItemId) {
      const incomeItem = budget.incomeItems.find(i => i.id === data.incomeItemId);
      if (!incomeItem) {
        throw new InvalidBudgetItemReferenceError('Income item not found in this budget');
      }

      const usedCents = await transactionRepository.getUsedCentsForIncomeItem(data.incomeItemId);
      const remainingCents = incomeItem.amountCents - usedCents;
      if (amountCents > remainingCents) {
        throw new IncomeLimitExceededError(
          `Transaction amount (${fromCents(amountCents)}) exceeds remaining income balance (${fromCents(remainingCents).toFixed(2)}) for "${incomeItem.description}"`
        );
      }
    }

    // 4. Validate expenseItemId belongs to this budget. There is deliberately
    //    NO limit check: an expense that already happened must be recordable
    //    even if it blows the plan — the budget reports it as `exceeded`.
    if (data.expenseItemId) {
      const expenseItem = budget.expenseItems.find(e => e.id === data.expenseItemId);
      if (!expenseItem) {
        throw new InvalidBudgetItemReferenceError('Expense item not found in this budget');
      }
    }

    // 5. Compute the balance delta up front so we fail fast on unsupported types
    const deltaCents = balanceDeltaCents(data.type, amountCents);

    // 6. Build the transaction row payload
    const txData: any = {
      userId,
      budgetId: data.budgetId,
      date: new Date(data.date),
      occurredAt: new Date(data.date),
      amount: fromCents(amountCents),
      amountCents,
      vendor: data.vendor,
      type: data.type,
      accountId: data.accountId,
      source: 'manual'
    };
    if (data.description !== undefined) txData.description = data.description;
    if (data.incomeItemId !== undefined) txData.incomeItemId = data.incomeItemId;
    if (data.expenseItemId !== undefined) txData.expenseItemId = data.expenseItemId;
    if (data.installmentCurrent !== undefined) txData.installmentCurrent = data.installmentCurrent;
    if (data.installmentTotal !== undefined) txData.installmentTotal = data.installmentTotal;
    if (data.installmentOriginal !== undefined) {
      txData.installmentOriginalCents = toCents(data.installmentOriginal);
      txData.installmentOriginal = fromCents(txData.installmentOriginalCents);
    }

    // 7. Atomic: row insert + balance update commit or roll back together
    const transaction = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: txData,
        include: transactionIncludes
      });
      await tx.account.update({
        where: { id: data.accountId },
        data: balanceIncrement(deltaCents)
      });
      return created;
    });

    logger.info(`Transaction created: ${transaction.id} (account ${data.accountId} delta ${fromCents(deltaCents)})`);
    return transaction;
  }

  /**
     * Get paginated transactions for a user
     */
  async getTransactions (
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
  async getTransactionById (id: string, userId: string): Promise<EnhancedTransaction> {
    const transaction = await transactionRepository.findByIdAndUser(id, userId);

    if (!transaction) {
      throw new TransactionNotFoundError();
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
  async updateTransaction (
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

    // 2. Resolve effective values (all money in cents)
    const newAccountId = data.accountId ?? existing.accountId;
    const newType = data.type ?? existing.type;
    const newAmountCents = data.amount !== undefined ? toCents(data.amount) : existing.amountCents;

    // 3. Re-validate item links if the caller changed anything that moves them
    const budgetId = existing.budgetId;

    if (budgetId && (data.incomeItemId !== undefined || data.expenseItemId !== undefined || data.amount !== undefined)) {
      const budget = await budgetRepository.findByIdAndUser(budgetId, userId);
      if (!budget) throw new BudgetNotFoundError();

      const existingIncomeItemId = existing.incomeItemId;
      const newIncomeItemId = data.incomeItemId !== undefined ? data.incomeItemId : existingIncomeItemId;
      if (newIncomeItemId) {
        const incomeItem = budget.incomeItems.find(i => i.id === newIncomeItemId);
        if (!incomeItem) throw new InvalidBudgetItemReferenceError('Income item not found in this budget');

        const usedCents = await transactionRepository.getUsedCentsForIncomeItem(newIncomeItemId);
        // Exclude the current row's contribution since we're updating it in place
        const usedExcludingCurrent = newIncomeItemId === existingIncomeItemId
          ? usedCents - existing.amountCents
          : usedCents;
        const remainingCents = incomeItem.amountCents - usedExcludingCurrent;

        if (newAmountCents > remainingCents) {
          throw new IncomeLimitExceededError(
            `Transaction amount (${fromCents(newAmountCents)}) exceeds remaining income balance (${fromCents(remainingCents).toFixed(2)}) for "${incomeItem.description}"`
          );
        }
      }

      // Expense items: membership only, no limit (overspend is a status).
      const newExpenseItemId = data.expenseItemId !== undefined ? data.expenseItemId : existing.expenseItemId;
      if (newExpenseItemId) {
        const expenseItem = budget.expenseItems.find(e => e.id === newExpenseItemId);
        if (!expenseItem) throw new InvalidBudgetItemReferenceError('Expense item not found in this budget');
      }
    }

    // 4. If the account is changing, make sure the target belongs to this user
    if (data.accountId && data.accountId !== existing.accountId) {
      await this.assertAccountBelongsToUser(data.accountId, userId);
    }

    // 5. Compute deltas: reverse old effect, apply new effect
    const oldDeltaCents = balanceDeltaCents(existing.type, existing.amountCents);
    const newDeltaCents = balanceDeltaCents(newType, newAmountCents);

    // 6. Build update payload from ONLY the editable Transaction fields.
    // Never spread the raw request body — clients may send extra fields
    // (e.g. `category`, `owner`, `budgetId`) that aren't columns on
    // Transaction and would make Prisma reject the whole update.
    const updateData: Prisma.TransactionUncheckedUpdateInput = {};
    if (data.date !== undefined) {
      updateData.date = new Date(data.date);
      updateData.occurredAt = new Date(data.date);
    }
    // `fingerprint` is deliberately NOT recomputed: it identifies what the
    // screenshot showed, so re-importing that screenshot after a manual fix
    // (e.g. a corrected OCR amount) still recognises the row.
    if (data.amount !== undefined) {
      updateData.amountCents = newAmountCents;
      updateData.amount = fromCents(newAmountCents);
    }
    if (data.vendor !== undefined) updateData.vendor = data.vendor;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.accountId !== undefined) updateData.accountId = data.accountId;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.incomeItemId !== undefined) updateData.incomeItemId = data.incomeItemId;
    if (data.expenseItemId !== undefined) updateData.expenseItemId = data.expenseItemId;
    if (data.installmentCurrent !== undefined) updateData.installmentCurrent = data.installmentCurrent;
    if (data.installmentTotal !== undefined) updateData.installmentTotal = data.installmentTotal;
    if (data.installmentOriginal !== undefined) {
      const originalCents = toCents(data.installmentOriginal);
      updateData.installmentOriginalCents = originalCents;
      updateData.installmentOriginal = fromCents(originalCents);
    }

    // 7. Atomic: balance reversal on old account + balance apply on new account + row update
    const updated = await prisma.$transaction(async (tx) => {
      // Reverse old effect on old account
      await tx.account.update({
        where: { id: existing.accountId },
        data: balanceIncrement(-oldDeltaCents)
      });
      // Apply new effect on (possibly different) new account
      await tx.account.update({
        where: { id: newAccountId },
        data: balanceIncrement(newDeltaCents)
      });
      // Update the transaction row
      return await tx.transaction.update({
        where: { id },
        data: updateData,
        include: transactionIncludes
      });
    });

    logger.info(
      `Transaction updated: ${id} (reversed ${fromCents(oldDeltaCents)} on ${existing.accountId}, applied ${fromCents(newDeltaCents)} on ${newAccountId})`
    );
    return updated;
  }

  /**
     * Delete a transaction.
     * Atomically: remove the row + reverse its balance effect.
     */
  async deleteTransaction (id: string, userId: string): Promise<void> {
    const existing = await this.getTransactionById(id, userId);

    const deltaCents = balanceDeltaCents(existing.type, existing.amountCents);

    await prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: existing.accountId },
        data: balanceIncrement(-deltaCents)
      });
      await tx.transaction.delete({
        where: { id }
      });
    });

    logger.info(`Transaction deleted: ${id} (reversed ${fromCents(deltaCents)} on account ${existing.accountId})`);
  }

  /**
     * Get financial summary for user
     */
  async getFinancialSummary (userId: string) {
    return await transactionRepository.getTransactionSummary(userId);
  }

  /**
     * Get monthly summary for user
     */
  async getMonthlySummary (userId: string, year: number, month: number) {
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
  async getBudgetBalance (budgetId: string, userId: string) {
    // Verify budget belongs to user (not owned ≡ not found → 404)
    const budget = await budgetRepository.findByIdAndUser(budgetId, userId);
    if (!budget) throw new BudgetNotFoundError();

    // One grouped sum per item kind instead of one query per budget line (N+1).
    const [spentByExpenseItem, usedByIncomeItem] = await Promise.all([
      transactionRepository.getSpentCentsByExpenseItems(budget.expenseItems.map((item) => item.id)),
      transactionRepository.getUsedCentsByIncomeItems(budget.incomeItems.map((item) => item.id))
    ]);

    // For each expense item: spent vs budgeted, plus its status. `remaining`
    // goes negative when a line is overspent.
    const expenseBreakdown = budget.expenseItems.map((item) => {
      const spentCents = spentByExpenseItem.get(item.id) ?? 0;
      return {
        id: item.id,
        description: item.description,
        budgeted: fromCents(item.amountCents),
        spent: fromCents(spentCents),
        remaining: fromCents(item.amountCents - spentCents),
        percentUsed: item.amountCents > 0 ? (spentCents / item.amountCents) * 100 : 0,
        status: statusOf(item.amountCents, spentCents)
      };
    });

    // For each income item, calculate used vs available
    const incomeBreakdown = budget.incomeItems.map((item) => {
      const usedCents = usedByIncomeItem.get(item.id) ?? 0;
      return {
        id: item.id,
        description: item.description,
        available: fromCents(item.amountCents),
        used: fromCents(usedCents),
        remaining: fromCents(item.amountCents - usedCents),
        percentUsed: item.amountCents > 0 ? (usedCents / item.amountCents) * 100 : 0
      };
    });

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
