import { BaseRepository } from './base.repository';
import { Budget, IBudget, IIncomeItem, IExpenseItem } from '../models/Budget';
import { Types } from 'mongoose';

/**
 * Budget Repository
 * Handles all database operations for Budget entity
 */
export class BudgetRepository extends BaseRepository<IBudget> {
  constructor() {
    super(Budget);
  }

  /**
   * Find all budgets for a user with optional filters
   */
  async findByUser(
    userId: Types.ObjectId | string,
    filters?: { year?: number; month?: number }
  ): Promise<IBudget[]> {
    const query: any = { userId };

    if (filters?.year !== undefined) {
      query.year = filters.year;
    }

    if (filters?.month !== undefined) {
      query.month = filters.month;
    }

    return this.model.find(query).sort({ year: -1, month: -1 }).exec();
  }

  /**
   * Find budget by user and period
   */
  async findByUserAndPeriod(
    userId: Types.ObjectId | string,
    year: number,
    month: number
  ): Promise<IBudget | null> {
    return this.model.findOne({ userId, year, month }).exec();
  }

  /**
   * Check if budget exists for user and period
   */
  async budgetExists(
    userId: Types.ObjectId | string,
    year: number,
    month: number
  ): Promise<boolean> {
    return this.exists({ userId, year, month });
  }

  /**
   * Create budget with validation for duplicate
   */
  async createBudget(data: {
    userId: Types.ObjectId | string;
    year: number;
    month: number;
    incomeItems?: IIncomeItem[];
    expenseItems?: IExpenseItem[];
  }): Promise<IBudget> {
    // Check for duplicate
    const exists = await this.budgetExists(data.userId, data.year, data.month);
    if (exists) {
      throw new Error(`Budget for ${data.year}-${data.month} already exists`);
    }

    return this.create({
      userId: data.userId,
      year: data.year,
      month: data.month,
      incomeItems: data.incomeItems || [],
      expenseItems: data.expenseItems || []
    } as Partial<IBudget>);
  }

  /**
   * Update budget by ID (only if belongs to user)
   */
  async updateByIdAndUser(
    budgetId: string,
    userId: Types.ObjectId | string,
    data: Partial<IBudget>
  ): Promise<IBudget | null> {
    return this.model
      .findOneAndUpdate(
        { _id: budgetId, userId },
        data,
        { new: true, runValidators: true }
      )
      .exec();
  }

  /**
   * Delete budget by ID (only if belongs to user)
   */
  async deleteByIdAndUser(
    budgetId: string,
    userId: Types.ObjectId | string
  ): Promise<IBudget | null> {
    return this.model.findOneAndDelete({ _id: budgetId, userId }).exec();
  }

  /**
   * Add income item to budget
   */
  async addIncomeItem(
    budgetId: string,
    userId: Types.ObjectId | string,
    incomeItem: IIncomeItem
  ): Promise<IBudget | null> {
    return this.model
      .findOneAndUpdate(
        { _id: budgetId, userId },
        { $push: { incomeItems: incomeItem } },
        { new: true, runValidators: true }
      )
      .exec();
  }

  /**
   * Update income items (replace all)
   */
  async updateIncomeItems(
    budgetId: string,
    userId: Types.ObjectId | string,
    incomeItems: IIncomeItem[]
  ): Promise<IBudget | null> {
    return this.model
      .findOneAndUpdate(
        { _id: budgetId, userId },
        { incomeItems },
        { new: true, runValidators: true }
      )
      .exec();
  }

  /**
   * Remove income item from budget
   */
  async removeIncomeItem(
    budgetId: string,
    userId: Types.ObjectId | string,
    itemId: string
  ): Promise<IBudget | null> {
    return this.model
      .findOneAndUpdate(
        { _id: budgetId, userId },
        { $pull: { incomeItems: { _id: itemId } } },
        { new: true }
      )
      .exec();
  }

  /**
   * Add expense item to budget
   */
  async addExpenseItem(
    budgetId: string,
    userId: Types.ObjectId | string,
    expenseItem: IExpenseItem
  ): Promise<IBudget | null> {
    return this.model
      .findOneAndUpdate(
        { _id: budgetId, userId },
        { $push: { expenseItems: expenseItem } },
        { new: true, runValidators: true }
      )
      .exec();
  }

  /**
   * Update expense items (replace all)
   */
  async updateExpenseItems(
    budgetId: string,
    userId: Types.ObjectId | string,
    expenseItems: IExpenseItem[]
  ): Promise<IBudget | null> {
    return this.model
      .findOneAndUpdate(
        { _id: budgetId, userId },
        { expenseItems },
        { new: true, runValidators: true }
      )
      .exec();
  }

  /**
   * Remove expense item from budget
   */
  async removeExpenseItem(
    budgetId: string,
    userId: Types.ObjectId | string,
    itemId: string
  ): Promise<IBudget | null> {
    return this.model
      .findOneAndUpdate(
        { _id: budgetId, userId },
        { $pull: { expenseItems: { _id: itemId } } },
        { new: true }
      )
      .exec();
  }

  /**
   * Get budget statistics for a user
   */
  async getUserBudgetStats(userId: Types.ObjectId | string): Promise<{
    totalBudgets: number;
    totalIncome: number;
    totalExpenses: number;
    totalSavings: number;
    averageSavingsRate: number;
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
  async getPaginatedIncomeItems(
    budgetId: string,
    userId: Types.ObjectId | string,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    items: IIncomeItem[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }> {
    const budget = await this.model.findOne({ _id: budgetId, userId }).exec();

    if (!budget) {
      throw new Error('Budget not found');
    }

    const total = budget.incomeItems.length;
    const pages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    const items = budget.incomeItems.slice(skip, skip + limit);

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
  async getPaginatedExpenseItems(
    budgetId: string,
    userId: Types.ObjectId | string,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    items: IExpenseItem[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }> {
    const budget = await this.model.findOne({ _id: budgetId, userId }).exec();

    if (!budget) {
      throw new Error('Budget not found');
    }

    const total = budget.expenseItems.length;
    const pages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    const items = budget.expenseItems.slice(skip, skip + limit);

    return {
      items,
      total,
      page,
      limit,
      pages
    };
  }

  /**
   * Update a single income item
   */
  async updateIncomeItem(
    budgetId: string,
    userId: Types.ObjectId | string,
    incomeId: string,
    incomeItem: IIncomeItem
  ): Promise<IBudget | null> {
    // First verify the item exists
    const budget = await this.model.findOne({
      _id: budgetId,
      userId,
      'incomeItems._id': incomeId
    }).exec();

    if (!budget) {
      throw new Error('Budget not found or income item not found');
    }

    // Update the specific income item using positional operator $
    return this.model
      .findOneAndUpdate(
        {
          _id: budgetId,
          userId,
          'incomeItems._id': incomeId
        },
        {
          $set: {
            'incomeItems.$.description': incomeItem.description,
            'incomeItems.$.amount': incomeItem.amount,
            'incomeItems.$.type': incomeItem.type
          }
        },
        { new: true, runValidators: true }
      )
      .exec();
  }

  /**
   * Update a single expense item
   */
  async updateExpenseItem(
    budgetId: string,
    userId: Types.ObjectId | string,
    expenseId: string,
    expenseItem: IExpenseItem
  ): Promise<IBudget | null> {
    // First verify the item exists
    const budget = await this.model.findOne({
      _id: budgetId,
      userId,
      'expenseItems._id': expenseId
    }).exec();

    if (!budget) {
      throw new Error('Budget not found or expense item not found');
    }

    // Update the specific expense item using positional operator $
    return this.model
      .findOneAndUpdate(
        {
          _id: budgetId,
          userId,
          'expenseItems._id': expenseId
        },
        {
          $set: {
            'expenseItems.$.description': expenseItem.description,
            'expenseItems.$.amount': expenseItem.amount,
            'expenseItems.$.type': expenseItem.type
          }
        },
        { new: true, runValidators: true }
      )
      .exec();
  }
}

// Export singleton instance
export const budgetRepository = new BudgetRepository();
