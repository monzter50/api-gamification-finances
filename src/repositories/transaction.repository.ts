import { BaseRepository } from './base.repository';
import { type Transaction } from '@prisma/client';

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
    type: string
  } | null
  expenseItem?: {
    id: string
    description: string
    amount: number
    type: string
  } | null
};

const transactionIncludes = {
  account: {
    select: { id: true, name: true, type: true, currency: true }
  },
  budget: {
    select: { id: true, year: true, month: true }
  },
  incomeItem: {
    select: { id: true, description: true, amount: true, type: true }
  },
  expenseItem: {
    select: { id: true, description: true, amount: true, type: true }
  }
};

export class TransactionRepository extends BaseRepository<Transaction> {
  constructor() {
    super('transaction');
  }

  /**
   * Create a transaction with relations included
   */
  async createTransaction(data: {
    userId: string
    budgetId?: string
    date: Date
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
    return this.model.create({
      data,
      include: transactionIncludes
    });
  }

  /**
   * Find transaction by ID and verify user ownership
   */
  async findByIdAndUser(id: string, userId: string): Promise<EnhancedTransaction | null> {
    return this.model.findFirst({
      where: { id, userId },
      include: transactionIncludes
    });
  }

  /**
   * Find transactions by user with optional filters (paginated)
   */
  async findByUserPaginated(
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
  }> {
    const where: any = { userId };

    if (filters.type) where.type = filters.type;
    if (filters.budgetId) where.budgetId = filters.budgetId;
    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = filters.startDate;
      if (filters.endDate) where.date.lte = filters.endDate;
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.model.findMany({
        where,
        include: transactionIncludes,
        skip,
        take: limit,
        orderBy: { date: 'desc' }
      }),
      this.model.count({ where })
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Find transactions by user (no pagination)
   */
  async findByUser(userId: string): Promise<EnhancedTransaction[]> {
    return this.model.findMany({
      where: { userId },
      include: transactionIncludes,
      orderBy: { date: 'desc' }
    });
  }

  /**
   * Find transactions by user and date range
   */
  async findByUserAndDateRange(
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
  async findByBudget(budgetId: string): Promise<EnhancedTransaction[]> {
    return this.model.findMany({
      where: { budgetId },
      include: transactionIncludes,
      orderBy: { date: 'desc' }
    });
  }

  /**
   * Update transaction by ID (only if belongs to user)
   */
  async updateByIdAndUser(
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
  async deleteByIdAndUser(
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
   * Get total spent against a specific expense item
   */
  async getSpentForExpenseItem(expenseItemId: string): Promise<number> {
    const result = await this.model.aggregate({
      where: { expenseItemId },
      _sum: { amount: true }
    });
    return result._sum.amount || 0;
  }

  /**
   * Get total used from a specific income item
   */
  async getUsedForIncomeItem(incomeItemId: string): Promise<number> {
    const result = await this.model.aggregate({
      where: { incomeItemId },
      _sum: { amount: true }
    });
    return result._sum.amount || 0;
  }

  /**
   * Get transaction summary (totals by type)
   */
  async getTransactionSummary(
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
        _sum: { amount: true },
        _count: { id: true }
      }),
      this.model.aggregate({
        where: { userId, type: 'expense', ...dateFilter },
        _sum: { amount: true },
        _count: { id: true }
      })
    ]);

    const totalIncome = income._sum.amount || 0;
    const totalExpense = expense._sum.amount || 0;

    return {
      totalIncome,
      totalExpense,
      incomeCount: income._count.id || 0,
      expenseCount: expense._count.id || 0,
      netBalance: totalIncome - totalExpense
    };
  }

}

export const transactionRepository = new TransactionRepository();
