import type { Response } from 'express';
import {
  BudgetRequest,
  CreateBudgetBody,
  UpdateBudgetBody,
  AddIncomeItemBody,
  AddExpenseItemBody,
  UpdateIncomeItemsBody,
  UpdateExpenseItemsBody,
  UpdateIncomeItemBody,
  UpdateExpenseItemBody
} from '../types/budget.types';
import { budgetService } from '../services/budget.service';
import { logger } from '../config/logger';
import { validationResult } from 'express-validator';

/**
 * Budget Controller
 * Handles HTTP requests for budget operations
 */
export class BudgetController {
  /**
   * GET /api/budgets
   * Get all budgets for authenticated user
   */
  async getAllBudgets(req: BudgetRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;

      const filters: { year?: number; month?: number } = {};
      if (year !== undefined) filters.year = year;
      if (month !== undefined) filters.month = month;

      const budgets = await budgetService.getUserBudgets(userId, filters);

      res.status(200).json({
        success: true,
        data: budgets,
        message: 'Budgets retrieved successfully'
      });
    } catch (error) {
      logger.error('Error getting budgets:', error);
      res.status(500).json({
        success: false,
        error: 'Error retrieving budgets',
        statusCode: 500
      });
    }
  }

  /**
   * GET /api/budgets/:id
   * Get budget by ID
   */
  async getBudgetById(req: BudgetRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Budget ID is required',
          statusCode: 400
        });
        return;
      }

      const userId = req.user!.userId;
      const budget = await budgetService.getBudgetById(id, userId);

      res.status(200).json({
        success: true,
        data: budget,
        message: 'Budget retrieved successfully'
      });
    } catch (error) {
      logger.error('Error getting budget:', error);

      if ((error as Error).message === 'Budget not found') {
        res.status(404).json({
          success: false,
          error: 'Budget not found',
          statusCode: 404
        });
        return;
      }

      if ((error as Error).message === 'Unauthorized access to budget') {
        res.status(403).json({
          success: false,
          error: 'Unauthorized access to budget',
          statusCode: 403
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Error retrieving budget',
        statusCode: 500
      });
    }
  }

  /**
   * POST /api/budgets
   * Create new budget
   */
  async createBudget(req: BudgetRequest<CreateBudgetBody>, res: Response): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          errors: errors.array(),
          statusCode: 400
        });
        return;
      }

      const userId = req.user!.userId;
      const { year, month, incomeItems, expenseItems } = req.body;

      const budget = await budgetService.createBudget({
        userId,
        year,
        month,
        incomeItems: incomeItems || [],
        expenseItems: expenseItems || []
      });

      res.status(201).json({
        success: true,
        data: budget,
        message: 'Budget created successfully'
      });
    } catch (error) {
      logger.error('Error creating budget:', error);

      const errorMessage = (error as Error).message;
      if (errorMessage.includes('already exists')) {
        res.status(409).json({
          success: false,
          error: errorMessage,
          statusCode: 409
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Error creating budget',
        statusCode: 500
      });
    }
  }

  /**
   * PUT /api/budgets/:id
   * Update entire budget
   */
  async updateBudget(req: BudgetRequest<UpdateBudgetBody>, res: Response): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          errors: errors.array(),
          statusCode: 400
        });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Budget ID is required',
          statusCode: 400
        });
        return;
      }

      const userId = req.user!.userId;
      const { year, month, incomeItems, expenseItems } = req.body;

      const budget = await budgetService.updateBudget(id, userId, {
        year,
        month,
        ...(incomeItems && { incomeItems }),
        ...(expenseItems && { expenseItems })
      });

      res.status(200).json({
        success: true,
        data: budget,
        message: 'Budget updated successfully'
      });
    } catch (error) {
      logger.error('Error updating budget:', error);

      const errorMessage = (error as Error).message;
      if (errorMessage === 'Budget not found') {
        res.status(404).json({
          success: false,
          error: 'Budget not found',
          statusCode: 404
        });
        return;
      }

      if (errorMessage === 'Unauthorized access to budget') {
        res.status(403).json({
          success: false,
          error: 'Unauthorized access to budget',
          statusCode: 403
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Error updating budget',
        statusCode: 500
      });
    }
  }

  /**
   * DELETE /api/budgets/:id
   * Delete budget
   */
  async deleteBudget(req: BudgetRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Budget ID is required',
          statusCode: 400
        });
        return;
      }

      const userId = req.user!.userId;
      await budgetService.deleteBudget(id, userId);

      res.status(200).json({
        success: true,
        message: 'Budget deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting budget:', error);

      const errorMessage = (error as Error).message;
      if (errorMessage === 'Budget not found') {
        res.status(404).json({
          success: false,
          error: 'Budget not found',
          statusCode: 404
        });
        return;
      }

      if (errorMessage === 'Unauthorized access to budget') {
        res.status(403).json({
          success: false,
          error: 'Unauthorized access to budget',
          statusCode: 403
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Error deleting budget',
        statusCode: 500
      });
    }
  }

  /**
   * PATCH /api/budgets/:id/income
   * Update income items
   */
  async updateIncomeItems(req: BudgetRequest<UpdateIncomeItemsBody>, res: Response): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          errors: errors.array(),
          statusCode: 400
        });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Budget ID is required',
          statusCode: 400
        });
        return;
      }

      const userId = req.user!.userId;
      const { incomeItems } = req.body;

      const budget = await budgetService.updateIncomeItems(id, userId, incomeItems);

      res.status(200).json({
        success: true,
        data: budget,
        message: 'Income items updated successfully'
      });
    } catch (error) {
      logger.error('Error updating income items:', error);

      const errorMessage = (error as Error).message;
      if (errorMessage === 'Budget not found') {
        res.status(404).json({
          success: false,
          error: 'Budget not found',
          statusCode: 404
        });
        return;
      }

      if (errorMessage === 'Unauthorized access to budget') {
        res.status(403).json({
          success: false,
          error: 'Unauthorized access to budget',
          statusCode: 403
        });
        return;
      }

      res.status(400).json({
        success: false,
        error: errorMessage,
        statusCode: 400
      });
    }
  }

  /**
   * PATCH /api/budgets/:id/expense
   * Update expense items
   */
  async updateExpenseItems(req: BudgetRequest<UpdateExpenseItemsBody>, res: Response): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          errors: errors.array(),
          statusCode: 400
        });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Budget ID is required',
          statusCode: 400
        });
        return;
      }

      const userId = req.user!.userId;
      const { expenseItems } = req.body;

      const budget = await budgetService.updateExpenseItems(id, userId, expenseItems);

      res.status(200).json({
        success: true,
        data: budget,
        message: 'Expense items updated successfully'
      });
    } catch (error) {
      logger.error('Error updating expense items:', error);

      const errorMessage = (error as Error).message;
      if (errorMessage === 'Budget not found') {
        res.status(404).json({
          success: false,
          error: 'Budget not found',
          statusCode: 404
        });
        return;
      }

      if (errorMessage === 'Unauthorized access to budget') {
        res.status(403).json({
          success: false,
          error: 'Unauthorized access to budget',
          statusCode: 403
        });
        return;
      }

      res.status(400).json({
        success: false,
        error: errorMessage,
        statusCode: 400
      });
    }
  }

  /**
   * DELETE /api/budgets/:id/income/:incomeId
   * Delete income item
   */
  async deleteIncomeItem(req: BudgetRequest, res: Response): Promise<void> {
    try {
      const { id, incomeId } = req.params;
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Budget ID is required',
          statusCode: 400
        });
        return;
      }
      if (!incomeId) {
        res.status(400).json({
          success: false,
          error: 'Income ID is required',
          statusCode: 400
        });
        return;
      }

      const userId = req.user!.userId;
      const budget = await budgetService.removeIncomeItem(id, userId, incomeId);

      res.status(200).json({
        success: true,
        data: budget,
        message: 'Income item deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting income item:', error);

      const errorMessage = (error as Error).message;
      if (errorMessage === 'Budget not found') {
        res.status(404).json({
          success: false,
          error: 'Budget not found',
          statusCode: 404
        });
        return;
      }

      if (errorMessage === 'Unauthorized access to budget') {
        res.status(403).json({
          success: false,
          error: 'Unauthorized access to budget',
          statusCode: 403
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Error deleting income item',
        statusCode: 500
      });
    }
  }

  /**
   * DELETE /api/budgets/:id/expense/:expenseId
   * Delete expense item
   */
  async deleteExpenseItem(req: BudgetRequest, res: Response): Promise<void> {
    try {
      const { id, expenseId } = req.params;
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Budget ID is required',
          statusCode: 400
        });
        return;
      }
      if (!expenseId) {
        res.status(400).json({
          success: false,
          error: 'Expense ID is required',
          statusCode: 400
        });
        return;
      }

      const userId = req.user!.userId;
      const budget = await budgetService.removeExpenseItem(id, userId, expenseId);

      res.status(200).json({
        success: true,
        data: budget,
        message: 'Expense item deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting expense item:', error);

      const errorMessage = (error as Error).message;
      if (errorMessage === 'Budget not found') {
        res.status(404).json({
          success: false,
          error: 'Budget not found',
          statusCode: 404
        });
        return;
      }

      if (errorMessage === 'Unauthorized access to budget') {
        res.status(403).json({
          success: false,
          error: 'Unauthorized access to budget',
          statusCode: 403
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Error deleting expense item',
        statusCode: 500
      });
    }
  }

  /**
   * POST /api/budgets/:id/income
   * Add a single income item
   */
  async addIncomeItem(req: BudgetRequest<AddIncomeItemBody>, res: Response): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          errors: errors.array(),
          statusCode: 400
        });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Budget ID is required',
          statusCode: 400
        });
        return;
      }

      const userId = req.user!.userId;
      const { description, amount, type } = req.body;

      const budget = await budgetService.addIncomeItem(id, userId, { description, amount, type });

      res.status(201).json({
        success: true,
        data: budget,
        message: 'Income item added successfully'
      });
    } catch (error) {
      logger.error('Error adding income item:', error);

      const errorMessage = (error as Error).message;
      if (errorMessage === 'Budget not found') {
        res.status(404).json({
          success: false,
          error: 'Budget not found',
          statusCode: 404
        });
        return;
      }

      if (errorMessage === 'Unauthorized access to budget') {
        res.status(403).json({
          success: false,
          error: 'Unauthorized access to budget',
          statusCode: 403
        });
        return;
      }

      res.status(400).json({
        success: false,
        error: errorMessage,
        statusCode: 400
      });
    }
  }

  /**
   * POST /api/budgets/:id/expense
   * Add a single expense item
   */
  async addExpenseItem(req: BudgetRequest<AddExpenseItemBody>, res: Response): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          errors: errors.array(),
          statusCode: 400
        });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Budget ID is required',
          statusCode: 400
        });
        return;
      }

      const userId = req.user!.userId;
      const { description, amount, type } = req.body;

      const budget = await budgetService.addExpenseItem(id, userId, { description, amount, type });

      res.status(201).json({
        success: true,
        data: budget,
        message: 'Expense item added successfully'
      });
    } catch (error) {
      logger.error('Error adding expense item:', error);

      const errorMessage = (error as Error).message;
      if (errorMessage === 'Budget not found') {
        res.status(404).json({
          success: false,
          error: 'Budget not found',
          statusCode: 404
        });
        return;
      }

      if (errorMessage === 'Unauthorized access to budget') {
        res.status(403).json({
          success: false,
          error: 'Unauthorized access to budget',
          statusCode: 403
        });
        return;
      }

      res.status(400).json({
        success: false,
        error: errorMessage,
        statusCode: 400
      });
    }
  }

  /**
   * GET /api/budgets/stats
   * Get budget statistics for user
   */
  async getUserStats(req: BudgetRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const stats = await budgetService.getUserBudgetStats(userId);

      res.status(200).json({
        success: true,
        data: stats,
        message: 'Budget statistics retrieved successfully'
      });
    } catch (error) {
      logger.error('Error getting budget stats:', error);
      res.status(500).json({
        success: false,
        error: 'Error retrieving budget statistics',
        statusCode: 500
      });
    }
  }

  /**
   * GET /api/budgets/:id/income
   * Get income items from a budget (paginated by default)
   * Query params: page (default: 1), limit (default: 10)
   */
  async getIncomeItems(req: BudgetRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Budget ID is required',
          statusCode: 400
        });
        return;
      }

      const userId = req.user!.userId;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      const result = await budgetService.getPaginatedIncomeItems(id, userId, page, limit);

      res.status(200).json({
        success: true,
        data: result.items,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          pages: result.pages
        },
        message: 'Income items retrieved successfully'
      });
    } catch (error) {
      logger.error('Error getting income items:', error);

      const errorMessage = (error as Error).message;
      if (errorMessage === 'Budget not found' || errorMessage.includes('Unauthorized')) {
        res.status(404).json({
          success: false,
          error: 'Budget not found',
          statusCode: 404
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Error retrieving income items',
        statusCode: 500
      });
    }
  }

  /**
   * GET /api/budgets/:id/expense
   * Get expense items from a budget (paginated by default)
   * Query params: page (default: 1), limit (default: 10)
   */
  async getExpenseItems(req: BudgetRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Budget ID is required',
          statusCode: 400
        });
        return;
      }

      const userId = req.user!.userId;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      const result = await budgetService.getPaginatedExpenseItems(id, userId, page, limit);

      res.status(200).json({
        success: true,
        data: result.items,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          pages: result.pages
        },
        message: 'Expense items retrieved successfully'
      });
    } catch (error) {
      logger.error('Error getting expense items:', error);

      const errorMessage = (error as Error).message;
      if (errorMessage === 'Budget not found' || errorMessage.includes('Unauthorized')) {
        res.status(404).json({
          success: false,
          error: 'Budget not found',
          statusCode: 404
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Error retrieving expense items',
        statusCode: 500
      });
    }
  }

  /**
   * PUT /api/budgets/:id/income/:incomeId
   * Update a single income item
   */
  async updateIncomeItem(req: BudgetRequest<UpdateIncomeItemBody>, res: Response): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          errors: errors.array(),
          statusCode: 400
        });
        return;
      }

      const { id, incomeId } = req.params;
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Budget ID is required',
          statusCode: 400
        });
        return;
      }
      if (!incomeId) {
        res.status(400).json({
          success: false,
          error: 'Income ID is required',
          statusCode: 400
        });
        return;
      }

      const userId = req.user!.userId;
      const { description, amount, type } = req.body;

      const budget = await budgetService.updateIncomeItem(id, userId, incomeId, { description, amount, type });

      res.status(200).json({
        success: true,
        data: budget,
        message: 'Income item updated successfully'
      });
    } catch (error) {
      logger.error('Error updating income item:', error);

      const errorMessage = (error as Error).message;
      if (errorMessage === 'Budget not found') {
        res.status(404).json({
          success: false,
          error: 'Budget not found',
          statusCode: 404
        });
        return;
      }

      if (errorMessage === 'Income item not found') {
        res.status(404).json({
          success: false,
          error: 'Income item not found',
          statusCode: 404
        });
        return;
      }

      if (errorMessage === 'Unauthorized access to budget') {
        res.status(403).json({
          success: false,
          error: 'Unauthorized access to budget',
          statusCode: 403
        });
        return;
      }

      res.status(400).json({
        success: false,
        error: errorMessage,
        statusCode: 400
      });
    }
  }

  /**
   * PUT /api/budgets/:id/expense/:expenseId
   * Update a single expense item
   */
  async updateExpenseItem(req: BudgetRequest<UpdateExpenseItemBody>, res: Response): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          errors: errors.array(),
          statusCode: 400
        });
        return;
      }

      const { id, expenseId } = req.params;
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Budget ID is required',
          statusCode: 400
        });
        return;
      }
      if (!expenseId) {
        res.status(400).json({
          success: false,
          error: 'Expense ID is required',
          statusCode: 400
        });
        return;
      }

      const userId = req.user!.userId;
      const { description, amount, type } = req.body;

      const budget = await budgetService.updateExpenseItem(id, userId, expenseId, { description, amount, type });

      res.status(200).json({
        success: true,
        data: budget,
        message: 'Expense item updated successfully'
      });
    } catch (error) {
      logger.error('Error updating expense item:', error);

      const errorMessage = (error as Error).message;
      if (errorMessage === 'Budget not found') {
        res.status(404).json({
          success: false,
          error: 'Budget not found',
          statusCode: 404
        });
        return;
      }

      if (errorMessage === 'Expense item not found') {
        res.status(404).json({
          success: false,
          error: 'Expense item not found',
          statusCode: 404
        });
        return;
      }

      if (errorMessage === 'Unauthorized access to budget') {
        res.status(403).json({
          success: false,
          error: 'Unauthorized access to budget',
          statusCode: 403
        });
        return;
      }

      res.status(400).json({
        success: false,
        error: errorMessage,
        statusCode: 400
      });
    }
  }
}

// Export singleton instance
export const budgetController = new BudgetController();
