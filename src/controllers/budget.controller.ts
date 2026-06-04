import type { Response } from 'express';
import {
  type BudgetRequest,
  type CreateBudgetBody,
  type UpdateBudgetBody
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
  async getAllBudgets (req: BudgetRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;

      const filters: { year?: number, month?: number } = {};
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
  async getBudgetById (req: BudgetRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params as { id: string };
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
  async createBudget (req: BudgetRequest<CreateBudgetBody>, res: Response): Promise<void> {
    try {
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
  async updateBudget (req: BudgetRequest<UpdateBudgetBody>, res: Response): Promise<void> {
    try {
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

      const { id } = req.params as { id: string };
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Budget ID is required',
          statusCode: 400
        });
        return;
      }

      const userId = req.user!.userId;
      // Strategy B: PUT /budgets only touches budget's own scalar fields.
      // Income / expense items are managed exclusively through the nested
      // /income and /expense endpoints — see budget.validator for the guard.
      const { year, month } = req.body;

      const budget = await budgetService.updateBudget(id, userId, {
        year,
        month
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
  async deleteBudget (req: BudgetRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params as { id: string };
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
   * POST /api/budgets/:id/duplicate
   * Clone a budget (income + expense items only) into a new (year, month).
   *
   * Does NOT copy Transaction rows — those are historical and tied to the
   * SOURCE items by foreign key. The clone gets fresh items with new IDs.
   */
  async duplicateBudget (req: BudgetRequest<{ year: number, month: number }>, res: Response): Promise<void> {
    try {
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

      const { id } = req.params as { id: string };
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Source budget ID is required',
          statusCode: 400
        });
        return;
      }

      const userId = req.user!.userId;
      const { year, month } = req.body;

      const duplicated = await budgetService.duplicateBudget(
        id,
        userId,
        year,
        month
      );

      res.status(201).json({
        success: true,
        data: duplicated,
        message: 'Budget duplicated successfully'
      });
    } catch (error) {
      logger.error('Error duplicating budget:', error);

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

      if (errorMessage.includes('already exists')) {
        res.status(409).json({
          success: false,
          error: errorMessage,
          statusCode: 409
        });
        return;
      }

      if (
        errorMessage.startsWith('Cannot duplicate:') ||
        errorMessage.includes('Month must be between')
      ) {
        res.status(400).json({
          success: false,
          error: errorMessage,
          statusCode: 400
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Error duplicating budget',
        statusCode: 500
      });
    }
  }

  /**
   * GET /api/budgets/stats
   * Get budget statistics for user
   */
  async getUserStats (req: BudgetRequest, res: Response): Promise<void> {
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

export const budgetController = new BudgetController();
