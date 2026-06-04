import { BaseRepository } from './base.repository';
import { type Budget, type IncomeItem, type ExpenseItem } from '@prisma/client';
import {
  type IncomeItemInput,
  type ExpenseItemInput,
  type BudgetTotals,
  type IncomeItemMutationResult,
  type ExpenseItemMutationResult,
  type ItemRemovalResult
} from '../types/budget.types';
import prisma from '../config/database';

export type EnhancedBudget = Budget & {
  incomeItems: IncomeItem[]
  expenseItems: ExpenseItem[]
  totalIncome: number
  totalExpense: number
  netSavings: number
  savingsRate: number
};

/**
 * Budget Repository
 * Handles all database operations for Budget entity
 */
export class BudgetRepository extends BaseRepository<Budget> {
  constructor () {
    super('budget');
  }

  // Helper to enrich budget with virtual fields
  private enrichBudget (budget: Budget & { incomeItems: IncomeItem[], expenseItems: ExpenseItem[] }): EnhancedBudget {
    const totalIncome = budget.incomeItems.reduce((sum, item) => sum + item.amount, 0);
    const totalExpense = budget.expenseItems.reduce((sum, item) => sum + item.amount, 0);
    const netSavings = totalIncome - totalExpense;
    const savingsRate = totalIncome === 0 ? 0 : (netSavings / totalIncome) * 100;

    return {
      ...budget,
      totalIncome,
      totalExpense,
      netSavings,
      savingsRate
    };
  }

  /**
   * Compute aggregate totals for a budget WITHOUT loading the item rows.
   *
   * Used by item-level mutation endpoints (Option B) so a single-item change
   * costs O(1) rows instead of re-fetching the entire budget graph.
   */
  private async computeBudgetTotals (budgetId: string): Promise<BudgetTotals> {
    const [income, expense] = await Promise.all([
      prisma.incomeItem.aggregate({
        where: { budgetId },
        _sum: { amount: true }
      }),
      prisma.expenseItem.aggregate({
        where: { budgetId },
        _sum: { amount: true }
      })
    ]);

    const totalIncome = income._sum.amount ?? 0;
    const totalExpense = expense._sum.amount ?? 0;
    const netSavings = totalIncome - totalExpense;
    const savingsRate = totalIncome === 0 ? 0 : (netSavings / totalIncome) * 100;

    return { totalIncome, totalExpense, netSavings, savingsRate };
  }

  /**
   * Find all budgets for a user with optional filters
   */
  async findByUser (
    userId: string,
    filters?: { year?: number, month?: number }
  ): Promise<EnhancedBudget[]> {
    const where: any = { userId };

    if (filters?.year !== undefined) {
      where.year = filters.year;
    }

    if (filters?.month !== undefined) {
      where.month = filters.month;
    }

    const budgets = await this.model.findMany({
      where,
      include: { incomeItems: true, expenseItems: true },
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });

    return budgets.map((b: any) => this.enrichBudget(b));
  }

  /**
   * Find budget by user and period
   */
  async findByUserAndPeriod (
    userId: string,
    year: number,
    month: number
  ): Promise<EnhancedBudget | null> {
    const budget = await this.model.findFirst({
      where: { userId, year, month },
      include: { incomeItems: true, expenseItems: true }
    });

    return budget ? this.enrichBudget(budget) : null;
  }

  /**
   * Check if budget exists for user and period
   */
  async budgetExists (
    userId: string,
    year: number,
    month: number
  ): Promise<boolean> {
    const count = await this.model.count({
      where: { userId, year, month }
    });
    return count > 0;
  }

  /**
   * Create budget with validation for duplicate
   */
  async createBudget (data: {
    userId: string
    year: number
    month: number
    incomeItems?: IncomeItemInput[]
    expenseItems?: ExpenseItemInput[]
  }): Promise<EnhancedBudget> {
    // Check for duplicate
    const exists = await this.budgetExists(data.userId, data.year, data.month);
    if (exists) {
      throw new Error(`Budget for ${data.year}-${data.month} already exists`);
    }

    const budget = await this.model.create({
      data: {
        userId: data.userId,
        year: data.year,
        month: data.month,
        incomeItems: {
          create: data.incomeItems || []
        },
        expenseItems: {
          create: data.expenseItems || []
        }
      },
      include: { incomeItems: true, expenseItems: true }
    });

    return this.enrichBudget(budget);
  }

  /**
   * Update budget's OWN scalar fields only (year, month).
   *
   * Income and expense items must be managed through their dedicated
   * repository methods (addIncomeItem, updateIncomeItem, removeIncomeItem,
   * updateIncomeItems, and the expense equivalents).
   *
   * This is intentional: bulk-replacing items through this method would
   * require deleting rows referenced by Transaction.incomeItemId /
   * expenseItemId, causing either FK constraint errors or broken transaction
   * history. See Strategy B design note for rationale.
   */
  async updateByIdAndUser (
    budgetId: string,
    userId: string,
    data: {
      year?: number
      month?: number
    }
  ): Promise<EnhancedBudget | null> {
    // Ensure budget belongs to user first
    const exists = await this.model.findFirst({ where: { id: budgetId, userId } });
    if (!exists) return null;

    const budget = await this.model.update({
      where: { id: budgetId },
      data,
      include: { incomeItems: true, expenseItems: true }
    });

    return this.enrichBudget(budget);
  }

  /**
   * Delete budget by ID (only if belongs to user)
   */
  async deleteByIdAndUser (
    budgetId: string,
    userId: string
  ): Promise<EnhancedBudget | null> {
    // Ensure budget belongs to user first
    const exists = await this.model.findFirst({ where: { id: budgetId, userId } });
    if (!exists) return null;

    // Delete related items happen automatically via Cascade in schema?
    // If not configured, we manually delete. I added Cascade in schema.
    const budget = await this.model.delete({
      where: { id: budgetId },
      include: { incomeItems: true, expenseItems: true }
    });

    return this.enrichBudget(budget);
  }

  /**
   * Add income item to budget (Option B).
   *
   * Returns the CREATED item + recomputed totals — NOT the full parent budget.
   */
  async addIncomeItem (
    budgetId: string,
    userId: string,
    incomeItem: IncomeItemInput
  ): Promise<IncomeItemMutationResult | null> {
    const exists = await this.model.findFirst({ where: { id: budgetId, userId } });
    if (!exists) return null;

    const created = await prisma.incomeItem.create({
      data: {
        description: incomeItem.description,
        amount: incomeItem.amount,
        type: incomeItem.type,
        accountId: incomeItem.accountId,
        budgetId
      }
    });

    const totals = await this.computeBudgetTotals(budgetId);
    return { item: created, totals };
  }

  /**
   * Update income items (replace all)
   * Prisma strategy: delete all, create new
   */
  async updateIncomeItems (
    budgetId: string,
    userId: string,
    incomeItems: IncomeItemInput[]
  ): Promise<EnhancedBudget | null> {
    const exists = await this.model.findFirst({ where: { id: budgetId, userId } });
    if (!exists) return null;

    // Transaction to ensure atomicity
    const budget = await prisma.$transaction(async (tx) => {
      await tx.incomeItem.deleteMany({ where: { budgetId } });
      return await tx.budget.update({
        where: { id: budgetId },
        data: {
          incomeItems: {
            create: incomeItems
          }
        },
        include: { incomeItems: true, expenseItems: true }
      });
    });

    return this.enrichBudget(budget);
  }

  /**
   * Remove income item from budget (Option B).
   *
   * Returns recomputed totals only — the item no longer exists.
   * Returns null if the budget doesn't belong to the user. If the item is
   * already gone, the delete is idempotent and totals still come back.
   */
  async removeIncomeItem (
    budgetId: string,
    userId: string,
    itemId: string
  ): Promise<ItemRemovalResult | null> {
    const exists = await this.model.findFirst({ where: { id: budgetId, userId } });
    if (!exists) return null;

    await prisma.incomeItem.deleteMany({
      where: { id: itemId, budgetId }
    });

    const totals = await this.computeBudgetTotals(budgetId);
    return { totals };
  }

  override async findById (id: string): Promise<EnhancedBudget | null> {
    const budget = await this.model.findUnique({
      where: { id },
      include: { incomeItems: true, expenseItems: true }
    });
    return budget ? this.enrichBudget(budget) : null;
  }

  /**
   * Add expense item to budget (Option B).
   *
   * Returns the CREATED item + recomputed totals — NOT the full parent budget.
   */
  async addExpenseItem (
    budgetId: string,
    userId: string,
    expenseItem: ExpenseItemInput
  ): Promise<ExpenseItemMutationResult | null> {
    const exists = await this.model.findFirst({ where: { id: budgetId, userId } });
    if (!exists) return null;

    const created = await prisma.expenseItem.create({
      data: {
        description: expenseItem.description,
        amount: expenseItem.amount,
        type: expenseItem.type,
        budgetId
      }
    });

    const totals = await this.computeBudgetTotals(budgetId);
    return { item: created, totals };
  }

  /**
   * Update expense items (replace all)
   */
  async updateExpenseItems (
    budgetId: string,
    userId: string,
    expenseItems: ExpenseItemInput[]
  ): Promise<EnhancedBudget | null> {
    const exists = await this.model.findFirst({ where: { id: budgetId, userId } });
    if (!exists) return null;

    const budget = await prisma.$transaction(async (tx) => {
      await tx.expenseItem.deleteMany({ where: { budgetId } });
      return await tx.budget.update({
        where: { id: budgetId },
        data: {
          expenseItems: {
            create: expenseItems
          }
        },
        include: { incomeItems: true, expenseItems: true }
      });
    });

    return this.enrichBudget(budget);
  }

  /**
   * Remove expense item from budget (Option B).
   *
   * Returns recomputed totals only — the item no longer exists.
   */
  async removeExpenseItem (
    budgetId: string,
    userId: string,
    itemId: string
  ): Promise<ItemRemovalResult | null> {
    const exists = await this.model.findFirst({ where: { id: budgetId, userId } });
    if (!exists) return null;

    await prisma.expenseItem.deleteMany({
      where: { id: itemId, budgetId }
    });

    const totals = await this.computeBudgetTotals(budgetId);
    return { totals };
  }

  /**
   * Get budget statistics for a user
   */
  async getUserBudgetStats (userId: string): Promise<{
    totalBudgets: number
    totalIncome: number
    totalExpenses: number
    totalSavings: number
    averageSavingsRate: number
  }> {
    const budgets = await this.findByUser(userId);

    const stats = budgets.reduce(
      (acc, budget) => {
        acc.totalIncome += budget.totalIncome;
        acc.totalExpenses += budget.totalExpense;
        acc.totalSavings += budget.netSavings;
        acc.savingsRates.push(budget.savingsRate);
        return acc;
      },
      {
        totalIncome: 0,
        totalExpenses: 0,
        totalSavings: 0,
        savingsRates: [] as number[]
      }
    );

    const averageSavingsRate =
      stats.savingsRates.length > 0
        ? stats.savingsRates.reduce((a, b) => a + b, 0) / stats.savingsRates.length
        : 0;

    return {
      totalBudgets: budgets.length,
      totalIncome: stats.totalIncome,
      totalExpenses: stats.totalExpenses,
      totalSavings: stats.totalSavings,
      averageSavingsRate
    };
  }

  /**
   * Get paginated income items from a budget
   */
  async getPaginatedIncomeItems (
    budgetId: string,
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{
      items: IncomeItem[]
      total: number
      page: number
      limit: number
      pages: number
    }> {
    // Verify budget exists
    const exists = await this.model.findFirst({ where: { id: budgetId, userId } });
    if (!exists) {
      throw new Error('Budget not found');
    }

    const total = await prisma.incomeItem.count({ where: { budgetId } });
    const pages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    const items = await prisma.incomeItem.findMany({
      where: { budgetId },
      skip,
      take: limit
    });

    return {
      items,
      total,
      page,
      limit,
      pages
    };
  }

  /**
   * Get paginated expense items from a budget
   */
  async getPaginatedExpenseItems (
    budgetId: string,
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{
      items: ExpenseItem[]
      total: number
      page: number
      limit: number
      pages: number
    }> {
    // Verify budget exists
    const exists = await this.model.findFirst({ where: { id: budgetId, userId } });
    if (!exists) {
      throw new Error('Budget not found');
    }

    const total = await prisma.expenseItem.count({ where: { budgetId } });
    const pages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    const items = await prisma.expenseItem.findMany({
      where: { budgetId },
      skip,
      take: limit
    });

    return {
      items,
      total,
      page,
      limit,
      pages
    };
  }

  /**
   * Update a single income item (Option B).
   *
   * Returns the UPDATED item + recomputed totals — NOT the full parent budget.
   * Returns null if the budget doesn't belong to the user OR the item is not
   * found within the budget.
   */
  async updateIncomeItem (
    budgetId: string,
    userId: string,
    incomeId: string,
    incomeItem: IncomeItemInput
  ): Promise<IncomeItemMutationResult | null> {
    const exists = await this.model.findFirst({ where: { id: budgetId, userId } });
    if (!exists) return null;

    const result = await prisma.incomeItem.updateMany({
      where: { id: incomeId, budgetId },
      data: {
        description: incomeItem.description,
        amount: incomeItem.amount,
        type: incomeItem.type,
        accountId: incomeItem.accountId
      }
    });
    if (result.count === 0) return null;

    const updated = await prisma.incomeItem.findUnique({ where: { id: incomeId } });
    if (!updated) return null;

    const totals = await this.computeBudgetTotals(budgetId);
    return { item: updated, totals };
  }

  /**
   * Duplicate a budget into a new period.
   *
   * Copies the source budget's incomeItems and expenseItems into a brand-new
   * Budget row at `(targetYear, targetMonth)`. Transactions are NOT copied —
   * they are historical records pointing at the SOURCE items, and the cloned
   * items are new rows with new IDs.
   *
   * Caller MUST have already:
   *   - verified the source budget belongs to `userId`
   *   - verified there is no existing budget at the target period
   *   - validated every income item's accountId still belongs to `userId`
   *
   * The whole clone (parent budget + nested items) runs inside a single
   * Prisma transaction so a partial duplicate is not possible.
   */
  async duplicateBudget (
    sourceBudgetId: string,
    userId: string,
    targetYear: number,
    targetMonth: number
  ): Promise<EnhancedBudget | null> {
    const source = await this.model.findFirst({
      where: { id: sourceBudgetId, userId },
      include: { incomeItems: true, expenseItems: true }
    });
    if (!source) return null;

    const incomeData = source.incomeItems.map((i: IncomeItem) => ({
      description: i.description,
      amount: i.amount,
      type: i.type,
      accountId: i.accountId
    }));

    const expenseData = source.expenseItems.map((e: ExpenseItem) => ({
      description: e.description,
      amount: e.amount,
      type: e.type
    }));

    const created = await prisma.$transaction(async (tx) => {
      return await tx.budget.create({
        data: {
          userId,
          year: targetYear,
          month: targetMonth,
          incomeItems: { create: incomeData },
          expenseItems: { create: expenseData }
        },
        include: { incomeItems: true, expenseItems: true }
      });
    });

    return this.enrichBudget(created);
  }

  /**
   * Update a single expense item (Option B).
   *
   * Returns the UPDATED item + recomputed totals — NOT the full parent budget.
   */
  async updateExpenseItem (
    budgetId: string,
    userId: string,
    expenseId: string,
    expenseItem: ExpenseItemInput
  ): Promise<ExpenseItemMutationResult | null> {
    const exists = await this.model.findFirst({ where: { id: budgetId, userId } });
    if (!exists) return null;

    const result = await prisma.expenseItem.updateMany({
      where: { id: expenseId, budgetId },
      data: {
        description: expenseItem.description,
        amount: expenseItem.amount,
        type: expenseItem.type
      }
    });
    if (result.count === 0) return null;

    const updated = await prisma.expenseItem.findUnique({ where: { id: expenseId } });
    if (!updated) return null;

    const totals = await this.computeBudgetTotals(budgetId);
    return { item: updated, totals };
  }
}

// Export singleton instance
export const budgetRepository = new BudgetRepository();
