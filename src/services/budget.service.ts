import { budgetRepository } from '../repositories/budget.repository';
import { IBudget, IIncomeItem, IExpenseItem, IncomeType, ExpenseType, INCOME_TYPES, EXPENSE_TYPES } from '../models/Budget';
import { Types } from 'mongoose';
import { logger } from '../config/logger';

/**
 * Budget Service
 * Handles business logic for budget operations
 */
export class BudgetService {
  /**
   * Get all budgets for a user with optional filters
   */
  async getUserBudgets(
    userId: string,
    filters?: { year?: number; month?: number }
  ): Promise<IBudget[]> {
    return budgetRepository.findByUser(userId, filters);
  }

  /**
   * Get budget by ID
   */
  async getBudgetById(budgetId: string, userId: string): Promise<IBudget> {
    const budget = await budgetRepository.findById(budgetId);

    if (!budget) {
      throw new Error('Budget not found');
    }

    // Verify ownership
    if (budget.userId.toString() !== userId) {
      throw new Error('Unauthorized access to budget');
    }

    return budget;
  }

  /**
   * Get budget by period
   */
  async getBudgetByPeriod(
    userId: string,
    year: number,
    month: number
  ): Promise<IBudget | null> {
    return budgetRepository.findByUserAndPeriod(userId, year, month);
  }

  /**
   * Create new budget
   */
  async createBudget(data: {
    userId: string;
    year: number;
    month: number;
    incomeItems?: IIncomeItem[];
    expenseItems?: IExpenseItem[];
  }): Promise<IBudget> {
    // Validate month range (0-11)
    if (data.month < 0 || data.month > 11) {
      throw new Error('Month must be between 0 and 11');
    }

    // Check if budget already exists for this period
    const existingBudget = await budgetRepository.findByUserAndPeriod(
      data.userId,
      data.year,
      data.month
    );

    if (existingBudget) {
      throw new Error(
        `Budget for ${data.year}-${data.month + 1} already exists`
      );
    }

    try {
      const budget = await budgetRepository.createBudget({
        userId: data.userId,
        year: data.year,
        month: data.month,
        incomeItems: data.incomeItems || [],
        expenseItems: data.expenseItems || []
      });

      logger.info(`Budget created for user ${data.userId}: ${budget._id}`);
      return budget;
    } catch (error) {
      logger.error('Error creating budget:', error);
      throw error;
    }
  }

  /**
   * Update budget
   */
  async updateBudget(
    budgetId: string,
    userId: string,
    data: {
      year?: number;
      month?: number;
      incomeItems?: IIncomeItem[];
      expenseItems?: IExpenseItem[];
    }
  ): Promise<IBudget> {
    // Verify budget exists and belongs to user
    await this.getBudgetById(budgetId, userId);

    // Validate month if provided
    if (data.month !== undefined && (data.month < 0 || data.month > 11)) {
      throw new Error('Month must be between 0 and 11');
    }

    const updatedBudget = await budgetRepository.updateByIdAndUser(
      budgetId,
      userId,
      data
    );

    if (!updatedBudget) {
      throw new Error('Failed to update budget');
    }

    logger.info(`Budget updated: ${budgetId}`);
    return updatedBudget;
  }

  /**
   * Delete budget
   */
  async deleteBudget(budgetId: string, userId: string): Promise<void> {
    // Verify budget exists and belongs to user
    await this.getBudgetById(budgetId, userId);

    const deletedBudget = await budgetRepository.deleteByIdAndUser(
      budgetId,
      userId
    );

    if (!deletedBudget) {
      throw new Error('Failed to delete budget');
    }

    logger.info(`Budget deleted: ${budgetId}`);
  }

  /**
   * Add/Update income items
   */
  async updateIncomeItems(
    budgetId: string,
    userId: string,
    incomeItems: IIncomeItem[]
  ): Promise<IBudget> {
    // Verify budget exists and belongs to user
    await this.getBudgetById(budgetId, userId);

    // Validate income items
    this.validateItems(incomeItems, 'income');

    const updatedBudget = await budgetRepository.updateIncomeItems(
      budgetId,
      userId,
      incomeItems
    );

    if (!updatedBudget) {
      throw new Error('Failed to update income items');
    }

    logger.info(`Income items updated for budget: ${budgetId}`);
    return updatedBudget;
  }

  /**
   * Add single income item
   */
  async addIncomeItem(
    budgetId: string,
    userId: string,
    incomeItem: IIncomeItem
  ): Promise<IBudget> {
    // Verify budget exists and belongs to user
    await this.getBudgetById(budgetId, userId);

    // Validate item
    this.validateItem(incomeItem, 'income');

    const updatedBudget = await budgetRepository.addIncomeItem(
      budgetId,
      userId,
      incomeItem
    );

    if (!updatedBudget) {
      throw new Error('Failed to add income item');
    }

    logger.info(`Income item added to budget: ${budgetId}`);
    return updatedBudget;
  }

  /**
   * Remove income item
   */
  async removeIncomeItem(
    budgetId: string,
    userId: string,
    itemId: string
  ): Promise<IBudget> {
    // Verify budget exists and belongs to user
    await this.getBudgetById(budgetId, userId);

    const updatedBudget = await budgetRepository.removeIncomeItem(
      budgetId,
      userId,
      itemId
    );

    if (!updatedBudget) {
      throw new Error('Failed to remove income item');
    }

    logger.info(`Income item removed from budget: ${budgetId}`);
    return updatedBudget;
  }

  /**
   * Add/Update expense items
   */
  async updateExpenseItems(
    budgetId: string,
    userId: string,
    expenseItems: IExpenseItem[]
  ): Promise<IBudget> {
    // Verify budget exists and belongs to user
    await this.getBudgetById(budgetId, userId);

    // Validate expense items
    this.validateItems(expenseItems, 'expense');

    const updatedBudget = await budgetRepository.updateExpenseItems(
      budgetId,
      userId,
      expenseItems
    );

    if (!updatedBudget) {
      throw new Error('Failed to update expense items');
    }

    logger.info(`Expense items updated for budget: ${budgetId}`);
    return updatedBudget;
  }

  /**
   * Add single expense item
   */
  async addExpenseItem(
    budgetId: string,
    userId: string,
    expenseItem: IExpenseItem
  ): Promise<IBudget> {
    // Verify budget exists and belongs to user
    await this.getBudgetById(budgetId, userId);

    // Validate item
    this.validateItem(expenseItem, 'expense');

    const updatedBudget = await budgetRepository.addExpenseItem(
      budgetId,
      userId,
      expenseItem
    );

    if (!updatedBudget) {
      throw new Error('Failed to add expense item');
    }

    logger.info(`Expense item added to budget: ${budgetId}`);
    return updatedBudget;
  }

  /**
   * Remove expense item
   */
  async removeExpenseItem(
    budgetId: string,
    userId: string,
    itemId: string
  ): Promise<IBudget> {
    // Verify budget exists and belongs to user
    await this.getBudgetById(budgetId, userId);

    const updatedBudget = await budgetRepository.removeExpenseItem(
      budgetId,
      userId,
      itemId
    );

    if (!updatedBudget) {
      throw new Error('Failed to remove expense item');
    }

    logger.info(`Expense item removed from budget: ${budgetId}`);
    return updatedBudget;
  }

  /**
   * Get budget statistics for a user
   */
  async getUserBudgetStats(userId: string) {
    return budgetRepository.getUserBudgetStats(userId);
  }

  /**
   * Get paginated income items
   */
  async getPaginatedIncomeItems(
    budgetId: string,
    userId: string,
    page: number = 1,
    limit: number = 10
  ) {
    // Verify budget exists and belongs to user
    await this.getBudgetById(budgetId, userId);

    return budgetRepository.getPaginatedIncomeItems(budgetId, userId, page, limit);
  }

  /**
   * Get paginated expense items
   */
  async getPaginatedExpenseItems(
    budgetId: string,
    userId: string,
    page: number = 1,
    limit: number = 10
  ) {
    // Verify budget exists and belongs to user
    await this.getBudgetById(budgetId, userId);

    return budgetRepository.getPaginatedExpenseItems(budgetId, userId, page, limit);
  }

  /**
   * Update a single income item
   */
  async updateIncomeItem(
    budgetId: string,
    userId: string,
    incomeId: string,
    incomeItem: IIncomeItem
  ): Promise<IBudget> {
    // Verify budget exists and belongs to user
    await this.getBudgetById(budgetId, userId);

    // Validate item
    this.validateItem(incomeItem, 'income');

    const updatedBudget = await budgetRepository.updateIncomeItem(
      budgetId,
      userId,
      incomeId,
      incomeItem
    );

    if (!updatedBudget) {
      throw new Error('Failed to update income item');
    }

    logger.info(`Income item ${incomeId} updated in budget: ${budgetId}`);
    return updatedBudget;
  }

  /**
   * Update a single expense item
   */
  async updateExpenseItem(
    budgetId: string,
    userId: string,
    expenseId: string,
    expenseItem: IExpenseItem
  ): Promise<IBudget> {
    // Verify budget exists and belongs to user
    await this.getBudgetById(budgetId, userId);

    // Validate item
    this.validateItem(expenseItem, 'expense');

    const updatedBudget = await budgetRepository.updateExpenseItem(
      budgetId,
      userId,
      expenseId,
      expenseItem
    );

    if (!updatedBudget) {
      throw new Error('Failed to update expense item');
    }

    logger.info(`Expense item ${expenseId} updated in budget: ${budgetId}`);
    return updatedBudget;
  }

  /**
   * Validate single item
   */
  private validateItem(
    item: IIncomeItem | IExpenseItem,
    type: 'income' | 'expense'
  ): void {
    if (!item.description || item.description.trim() === '') {
      throw new Error(`${type} description is required`);
    }

    if (item.amount === undefined || item.amount === null) {
      throw new Error(`${type} amount is required`);
    }

    if (item.amount < 0) {
      throw new Error(`${type} amount must be positive`);
    }

    // Validate income type if it's an income item
    if (type === 'income' && 'type' in item) {
      const incomeItem = item as IIncomeItem;
      if (!incomeItem.type) {
        throw new Error('Income type is required');
      }
      if (!INCOME_TYPES.includes(incomeItem.type)) {
        throw new Error(`Invalid income type. Must be one of: ${INCOME_TYPES.join(', ')}`);
      }
    }

    // Validate expense type if it's an expense item
    if (type === 'expense' && 'type' in item) {
      const expenseItem = item as IExpenseItem;
      if (!expenseItem.type) {
        throw new Error('Expense type is required');
      }
      if (!EXPENSE_TYPES.includes(expenseItem.type)) {
        throw new Error(`Invalid expense type. Must be one of: ${EXPENSE_TYPES.join(', ')}`);
      }
    }
  }

  /**
   * Validate multiple items
   */
  private validateItems(
    items: (IIncomeItem | IExpenseItem)[],
    type: 'income' | 'expense'
  ): void {
    if (!Array.isArray(items)) {
      throw new Error(`${type} items must be an array`);
    }

    items.forEach((item, index) => {
      try {
        this.validateItem(item, type);
      } catch (error) {
        throw new Error(
          `Invalid ${type} item at index ${index}: ${(error as Error).message}`
        );
      }
    });
  }
}

// Export singleton instance
export const budgetService = new BudgetService();
