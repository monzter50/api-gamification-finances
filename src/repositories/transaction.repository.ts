import { BaseRepository } from './base.repository';
import { type Prisma, type Transaction } from '@prisma/client';
import { fromCents } from '../utils/money';
import prisma from '../config/database';

/**
 * Enhanced Transaction with related entities
 */
export type EnhancedTransaction = Transaction & {
  account?: {
    id: string
    name: string
    type: string
    currency: string
  } | null
  budget?: {
    id: string
    year: number
    month: number
  } | null
  incomeItem?: {
    id: string
    description: string
    amount: number
    amountCents: number
    type: string
  } | null
  expenseItem?: {
    id: string
    description: string
    amount: number
    amountCents: number
    type: string
  } | null
};

export const transactionIncludes = {
  account: {
    select: { id: true, name: true, type: true, currency: true }
  },
  budget: {
    select: { id: true, year: true, month: true }
  },
  incomeItem: {
    select: { id: true, description: true, amount: true, amountCents: true, type: true }
  },
  expenseItem: {
    select: { id: true, description: true, amount: true, amountCents: true, type: true }
  }
};

export class TransactionRepository extends BaseRepository<Transaction> {
  constructor () {
    super('transaction');
  }

  /**
   * Create a transaction with relations included
   */
  async createTransaction (data: {
    userId: string
    budgetId?: string
    date: Date
    amount: number
    amountCents: number
    vendor: string
    type: string
    accountId: string
    description?: string
    incomeItemId?: string
    expenseItemId?: string
    installmentCurrent?: number
    installmentTotal?: number
    installmentOriginal?: number
    installmentOriginalCents?: number
  }): Promise<EnhancedTransaction> {
    return this.model.create({
      data,
      include: transactionIncludes
    });
  }

  /**
   * Find transaction by ID and verify user ownership
   */
  async findByIdAndUser (id: string, userId: string): Promise<EnhancedTransaction | null> {
    return this.model.findFirst({
      where: { id, userId },
      include: transactionIncludes
    });
  }

  /**
   * Find transactions by user with optional filters (paginated)
   */
  async findByUserPaginated (
    userId: string,
    filters: {
      type?: string
      budgetId?: string
      startDate?: Date
      endDate?: Date
    } = {},
    page: number = 1,
    limit: number = 10
  ): Promise<{
    data: EnhancedTransaction[]
    total: number
    page: number
    totalPages: number
    totals: { income: number, expense: number, savings: number, count: number }
  }> {
    const where: any = { userId };

    if (filters.type) where.type = filters.type;
    if (filters.budgetId) where.budgetId = filters.budgetId;
    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = filters.startDate;
      if (filters.endDate) where.date.lte = filters.endDate;
    }

    // Totals are computed over the SAME budget + date scope but independent of
    // the `type` filter, so the income/expense summaries always reflect the
    // whole set (not just the current page, and not narrowed by a type filter).
    const totalsWhere: any = { userId };
    if (filters.budgetId) totalsWhere.budgetId = filters.budgetId;
    if (where.date) totalsWhere.date = where.date;

    const skip = (page - 1) * limit;

    const [data, total, grouped] = await Promise.all([
      this.model.findMany({
        where,
        include: transactionIncludes,
        skip,
        take: limit,
        orderBy: { date: 'desc' }
      }),
      this.model.count({ where }),
      this.model.groupBy({
        by: ['type'],
        where: totalsWhere,
        _sum: { amountCents: true },
        _count: true
      })
    ]);

    const totals = { income: 0, expense: 0, savings: 0, count: 0 };
    for (const g of grouped as Array<{ type: string, _sum: { amountCents: number | null }, _count: number }>) {
      const sum = fromCents(g._sum.amountCents ?? 0);
      totals.count += g._count;
      if (g.type === 'income') { totals.income = sum; } else if (g.type === 'expense') { totals.expense = sum; } else if (g.type === 'savings') { totals.savings = sum; }
    }

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      totals
    };
  }

  /**
   * Find transactions by user (no pagination)
   */
  async findByUser (userId: string): Promise<EnhancedTransaction[]> {
    return this.model.findMany({
      where: { userId },
      include: transactionIncludes,
      orderBy: { date: 'desc' }
    });
  }

  /**
   * Find transactions by user and date range
   */
  async findByUserAndDateRange (
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<EnhancedTransaction[]> {
    return this.model.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: transactionIncludes,
      orderBy: { date: 'desc' }
    });
  }

  /**
   * Find transactions by budget
   */
  async findByBudget (budgetId: string): Promise<EnhancedTransaction[]> {
    return this.model.findMany({
      where: { budgetId },
      include: transactionIncludes,
      orderBy: { date: 'desc' }
    });
  }

  /**
   * Update transaction by ID (only if belongs to user)
   */
  async updateByIdAndUser (
    id: string,
    userId: string,
    data: Partial<Transaction>
  ): Promise<EnhancedTransaction | null> {
    const exists = await this.model.findFirst({ where: { id, userId } });
    if (!exists) return null;

    return this.model.update({
      where: { id },
      data,
      include: transactionIncludes
    });
  }

  /**
   * Delete transaction by ID (only if belongs to user)
   */
  async deleteByIdAndUser (
    id: string,
    userId: string
  ): Promise<EnhancedTransaction | null> {
    const exists = await this.model.findFirst({ where: { id, userId } });
    if (!exists) return null;

    return this.model.delete({
      where: { id },
      include: transactionIncludes
    });
  }

  /**
   * Total spent against a specific expense item, in cents
   */
  async getSpentCentsForExpenseItem (expenseItemId: string): Promise<number> {
    const result = await this.model.aggregate({
      where: { expenseItemId },
      _sum: { amountCents: true }
    });
    return result._sum.amountCents || 0;
  }

  /**
   * Total used from a specific income item, in cents
   */
  async getUsedCentsForIncomeItem (incomeItemId: string): Promise<number> {
    const result = await this.model.aggregate({
      where: { incomeItemId },
      _sum: { amountCents: true }
    });
    return result._sum.amountCents || 0;
  }

  /**
   * Transactions for a spreadsheet export: always scoped to `userId`,
   * oldest first, and bounded by `take` (callers pass max+1 to detect overflow).
   */
  async findForExport (
    userId: string,
    filters: { from?: Date, to?: Date, budgetId?: string },
    take: number
  ): Promise<Array<Prisma.TransactionGetPayload<{ include: typeof transactionIncludes }>>> {
    const where: Prisma.TransactionWhereInput = { userId };
    if (filters.budgetId !== undefined) where.budgetId = filters.budgetId;
    if (filters.from !== undefined || filters.to !== undefined) {
      where.date = {
        ...(filters.from !== undefined ? { gte: filters.from } : {}),
        ...(filters.to !== undefined ? { lte: filters.to } : {})
      };
    }
    return await prisma.transaction.findMany({
      where,
      include: transactionIncludes,
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      take
    });
  }

  /**
   * Spent cents per expense item for many items in ONE grouped query.
   * Items with no transactions are absent from the map (treat as 0).
   */
  async getSpentCentsByExpenseItems (expenseItemIds: string[]): Promise<Map<string, number>> {
    if (expenseItemIds.length === 0) return new Map();
    const rows = await prisma.transaction.groupBy({
      by: ['expenseItemId'],
      where: { expenseItemId: { in: expenseItemIds } },
      _sum: { amountCents: true }
    });
    return new Map(rows.map((r) => [r.expenseItemId!, r._sum.amountCents ?? 0]));
  }

  /**
   * Used cents per income item for many items in ONE grouped query.
   * Items with no transactions are absent from the map (treat as 0).
   */
  async getUsedCentsByIncomeItems (incomeItemIds: string[]): Promise<Map<string, number>> {
    if (incomeItemIds.length === 0) return new Map();
    const rows = await prisma.transaction.groupBy({
      by: ['incomeItemId'],
      where: { incomeItemId: { in: incomeItemIds } },
      _sum: { amountCents: true }
    });
    return new Map(rows.map((r) => [r.incomeItemId!, r._sum.amountCents ?? 0]));
  }

  /**
   * Get transaction summary (totals by type)
   */
  async getTransactionSummary (
    userId: string,
    year?: number,
    month?: number
  ): Promise<{
    totalIncome: number
    totalExpense: number
    incomeCount: number
    expenseCount: number
    netBalance: number
  }> {
    const dateFilter: any = {};
    if (year !== undefined && month !== undefined) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);
      dateFilter.date = { gte: startDate, lte: endDate };
    }

    const [income, expense] = await Promise.all([
      this.model.aggregate({
        where: { userId, type: 'income', ...dateFilter },
        _sum: { amountCents: true },
        _count: { id: true }
      }),
      this.model.aggregate({
        where: { userId, type: 'expense', ...dateFilter },
        _sum: { amountCents: true },
        _count: { id: true }
      })
    ]);

    const incomeCents: number = income._sum.amountCents || 0;
    const expenseCents: number = expense._sum.amountCents || 0;

    return {
      totalIncome: fromCents(incomeCents),
      totalExpense: fromCents(expenseCents),
      incomeCount: income._count.id || 0,
      expenseCount: expense._count.id || 0,
      netBalance: fromCents(incomeCents - expenseCents)
    };
  }
}

export const transactionRepository = new TransactionRepository();
