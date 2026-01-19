import { BaseRepository } from './base.repository';
import { type Transaction } from '@prisma/client';
import prisma from '../config/database';

export class TransactionRepository extends BaseRepository<Transaction> {
  constructor () {
    super('transaction');
  }

  /**
     * Find transactions by user
     */
  async findByUser (userId: string): Promise<Transaction[]> {
    return this.model.findMany({
      where: { userId },
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
  ): Promise<Transaction[]> {
    return this.model.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { date: 'desc' }
    });
  }

  /**
     * Find transactions by budget
     */
  async findByBudget (budgetId: string): Promise<Transaction[]> {
    return this.model.findMany({
      where: { budgetId },
      orderBy: { date: 'desc' }
    });
  }

  /**
     * Get spending by category
     */
  async getSpendingByCategory (
    userId: string,
    year: number,
    month: number
  ): Promise<Array<{ category: string, total: number, count: number }>> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const result = await this.model.groupBy({
      by: ['category'],
      where: {
        userId,
        type: 'expense',
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      _sum: {
        amount: true
      },
      _count: {
        category: true
      },
      orderBy: {
        _sum: {
          amount: 'desc'
        }
      }
    });

    return result.map((item: any) => ({
      category: item.category,
      total: item._sum.amount || 0,
      count: item._count.category || 0
    }));
  }
}

export const transactionRepository = new TransactionRepository();
