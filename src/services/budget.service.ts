import { budgetRepository, type EnhancedBudget } from '../repositories/budget.repository';
import { accountRepository } from '../repositories/account.repository';
import {
  type IncomeItemInput,
  type ExpenseItemInput,
  type IncomeItemMutationResult,
  type ExpenseItemMutationResult,
  type ItemRemovalResult
} from '../types/budget.types';
import { type IncomeType, type ExpenseType, INCOME_TYPES, EXPENSE_TYPES } from '../constants/budget.constants';
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
    filters?: { year?: number, month?: number }
  ): Promise<EnhancedBudget[]> {
    const budget = await budgetRepository.findByUser(userId, filters);
    return budget;
  }

  /**
   * Get budget by ID
   */
  async getBudgetById(budgetId: string, userId: string): Promise<EnhancedBudget> {
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
  ): Promise<EnhancedBudget | null> {
    return await budgetRepository.findByUserAndPeriod(userId, year, month);
  }

  /**
   * Create new budget
   */
  async createBudget(data: {
    userId: string
    year: number
    month: number
    incomeItems?: IncomeItemInput[]
    expenseItems?: ExpenseItemInput[]
  }): Promise<EnhancedBudget> {
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

    // Validate every income item's accountId belongs to this user BEFORE
    // attempting the create. We do this here (not in the repo) because
    // account ownership is a cross-aggregate concern — the repo shouldn't
    // know about Account semantics.
    const incomeAccountIds = Array.from(new Set((data.incomeItems ?? []).map(i => i.accountId)));
    for (const accountId of incomeAccountIds) {
      await this.assertAccountBelongsToUser(accountId, data.userId);
    }

    try {
      const budget = await budgetRepository.createBudget({
        userId: data.userId,
        year: data.year,
        month: data.month,
        incomeItems: data.incomeItems || [],
        expenseItems: data.expenseItems || []
      });

      logger.info(`Budget created for user ${data.userId}: ${budget.id}`);
      return budget;
    } catch (error) {
      logger.error('Error creating budget:', error);
      throw error;
    }
  }

  /**
   * Update budget's scalar fields (year, month) only.
   *
   * Income/expense items must be managed through the dedicated nested
   * endpoints:
   *   - POST/PUT/DELETE /api/budgets/:id/income[/:incomeId]
   *   - POST/PUT/DELETE /api/budgets/:id/expense[/:expenseId]
   *
   * See Strategy B design note.
   */
  async updateBudget(
    budgetId: string,
    userId: string,
    data: {
      year?: number
      month?: number
    }
  ): Promise<EnhancedBudget> {
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
    incomeItems: IncomeItemInput[]
  ): Promise<EnhancedBudget> {
    // Verify budget exists and belongs to user
    await this.getBudgetById(budgetId, userId);

    // Validate income items
    this.validateItems(incomeItems, 'income');

    // Every accountId must belong to this user
    const incomeAccountIds = Array.from(new Set(incomeItems.map(i => i.accountId)));
    for (const accountId of incomeAccountIds) {
      await this.assertAccountBelongsToUser(accountId, userId);
    }

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
   * Add single income item (Option B: returns { item, totals })
   */
  async addIncomeItem(
    budgetId: string,
    userId: string,
    incomeItem: IncomeItemInput
  ): Promise<IncomeItemMutationResult> {
    // Verify budget exists and belongs to user (throws on miss/unauthorized)
    await this.getBudgetById(budgetId, userId);

    // Validate item
    this.validateItem(incomeItem, 'income');

    // accountId is now required — make sure it belongs to this user
    await this.assertAccountBelongsToUser(incomeItem.accountId, userId);

    const result = await budgetRepository.addIncomeItem(
      budgetId,
      userId,
      incomeItem
    );

    if (!result) {
      throw new Error('Failed to add income item');
    }

    logger.info(`Income item added to budget: ${budgetId}`);
    return result;
  }

  /**
   * Remove income item (Option B: returns { totals } only)
   */
  async removeIncomeItem(
    budgetId: string,
    userId: string,
    itemId: string
  ): Promise<ItemRemovalResult> {
    // Verify budget exists and belongs to user
    await this.getBudgetById(budgetId, userId);

    const result = await budgetRepository.removeIncomeItem(
      budgetId,
      userId,
      itemId
    );

    if (!result) {
      throw new Error('Failed to remove income item');
    }

    logger.info(`Income item removed from budget: ${budgetId}`);
    return result;
  }

  /**
   * Add/Update expense items
   */
  async updateExpenseItems(
    budgetId: string,
    userId: string,
    expenseItems: ExpenseItemInput[]
  ): Promise<EnhancedBudget> {
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
   * Add single expense item (Option B: returns { item, totals })
   */
  async addExpenseItem(
    budgetId: string,
    userId: string,
    expenseItem: ExpenseItemInput
  ): Promise<ExpenseItemMutationResult> {
    // Verify budget exists and belongs to user
    await this.getBudgetById(budgetId, userId);

    // Validate item
    this.validateItem(expenseItem, 'expense');

    const result = await budgetRepository.addExpenseItem(
      budgetId,
      userId,
      expenseItem
    );

    if (!result) {
      throw new Error('Failed to add expense item');
    }

    logger.info(`Expense item added to budget: ${budgetId}`);
    return result;
  }

  /**
   * Remove expense item (Option B: returns { totals } only)
   */
  async removeExpenseItem(
    budgetId: string,
    userId: string,
    itemId: string
  ): Promise<ItemRemovalResult> {
    // Verify budget exists and belongs to user
    await this.getBudgetById(budgetId, userId);

    const result = await budgetRepository.removeExpenseItem(
      budgetId,
      userId,
      itemId
    );

    if (!result) {
      throw new Error('Failed to remove expense item');
    }

    logger.info(`Expense item removed from budget: ${budgetId}`);
    return result;
  }

  /**
   * Get budget statistics for a user
   */
  async getUserBudgetStats(userId: string) {
    return await budgetRepository.getUserBudgetStats(userId);
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

    return await budgetRepository.getPaginatedIncomeItems(budgetId, userId, page, limit);
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

    return await budgetRepository.getPaginatedExpenseItems(budgetId, userId, page, limit);
  }

  /**
   * Update a single income item (Option B: returns { item, totals })
   */
  async updateIncomeItem(
    budgetId: string,
    userId: string,
    incomeId: string,
    incomeItem: IncomeItemInput
  ): Promise<IncomeItemMutationResult> {
    // Verify budget exists and belongs to user
    await this.getBudgetById(budgetId, userId);

    // Validate item
    this.validateItem(incomeItem, 'income');

    // accountId is required — verify it belongs to this user (also guards
    // against reassigning income to an account the user does not own)
    await this.assertAccountBelongsToUser(incomeItem.accountId, userId);

    const result = await budgetRepository.updateIncomeItem(
      budgetId,
      userId,
      incomeId,
      incomeItem
    );

    // Budget ownership was verified above, so a null here means the item row
    // is not in this budget — surface as 404 via the controller.
    if (!result) {
      throw new Error('Income item not found');
    }

    logger.info(`Income item ${incomeId} updated in budget: ${budgetId}`);
    return result;
  }

  /**
   * Update a single expense item (Option B: returns { item, totals })
   */
  async updateExpenseItem(
    budgetId: string,
    userId: string,
    expenseId: string,
    expenseItem: ExpenseItemInput
  ): Promise<ExpenseItemMutationResult> {
    // Verify budget exists and belongs to user
    await this.getBudgetById(budgetId, userId);

    // Validate item
    this.validateItem(expenseItem, 'expense');

    const result = await budgetRepository.updateExpenseItem(
      budgetId,
      userId,
      expenseId,
      expenseItem
    );

    if (!result) {
      throw new Error('Expense item not found');
    }

    logger.info(`Expense item ${expenseId} updated in budget: ${budgetId}`);
    return result;
  }

  /**
   * Verify an account belongs to the given user. Throws a consistent error
   * so callers can map it to a 400 response. Deduplicates the same check
   * across income add/update/replace flows.
   */
  private async assertAccountBelongsToUser(accountId: string, userId: string): Promise<void> {
    const account = await accountRepository.findByIdAndUser(accountId, userId);
    if (!account) {
      throw new Error(`Account ${accountId} not found or does not belong to user`);
    }
  }

  /**
   * Validate single item
   */
  private validateItem(
    item: IncomeItemInput | ExpenseItemInput,
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
      const incomeItem = item as IncomeItemInput;
      if (!incomeItem.type) {
        throw new Error('Income type is required');
      }
      if (!INCOME_TYPES.includes(incomeItem.type as IncomeType)) {
        throw new Error(`Invalid income type. Must be one of: ${INCOME_TYPES.join(', ')}`);
      }
      if (!incomeItem.accountId) {
        throw new Error('Income accountId is required');
      }
    }

    // Validate expense type if it's an expense item
    if (type === 'expense' && 'type' in item) {
      const expenseItem = item as ExpenseItemInput;
      if (!expenseItem.type) {
        throw new Error('Expense type is required');
      }
      if (!EXPENSE_TYPES.includes(expenseItem.type as ExpenseType)) {
        throw new Error(`Invalid expense type. Must be one of: ${EXPENSE_TYPES.join(', ')}`);
      }
    }
  }

  /**
   * Validate multiple items
   */
  private validateItems(
    items: Array<IncomeItemInput | ExpenseItemInput>,
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
