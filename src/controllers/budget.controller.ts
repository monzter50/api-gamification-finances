import type { Response } from 'express';
import { AuthenticatedRequest } from '../types';
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
  async getAllBudgets(req: AuthenticatedRequest, res: Response): Promise<void> {
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
  async getBudgetById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
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
  async createBudget(req: AuthenticatedRequest, res: Response): Promise<void> {
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
  async updateBudget(req: AuthenticatedRequest, res: Response): Promise<void> {
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
      const userId = req.user!.userId;
      const { year, month, incomeItems, expenseItems } = req.body;

      const budget = await budgetService.updateBudget(id, userId, {
        year,
        month,
        incomeItems,
        expenseItems
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
  async deleteBudget(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
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
  async updateIncomeItems(req: AuthenticatedRequest, res: Response): Promise<void> {
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
  async updateExpenseItems(req: AuthenticatedRequest, res: Response): Promise<void> {
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
   * DELETE /api/budgets/:id/income/:itemId
   * Delete income item
   */
  async deleteIncomeItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id, itemId } = req.params;
      const userId = req.user!.userId;

      const budget = await budgetService.removeIncomeItem(id, userId, itemId);

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
   * DELETE /api/budgets/:id/expense/:itemId
   * Delete expense item
   */
  async deleteExpenseItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id, itemId } = req.params;
      const userId = req.user!.userId;

      const budget = await budgetService.removeExpenseItem(id, userId, itemId);

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
  async addIncomeItem(req: AuthenticatedRequest, res: Response): Promise<void> {
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
  async addExpenseItem(req: AuthenticatedRequest, res: Response): Promise<void> {
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
      const userId = req.user!.userId;
      const { description, amount } = req.body;

      const budget = await budgetService.addExpenseItem(id, userId, { description, amount });

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
  async getUserStats(req: AuthenticatedRequest, res: Response): Promise<void> {
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
}

// Export singleton instance
export const budgetController = new BudgetController();
