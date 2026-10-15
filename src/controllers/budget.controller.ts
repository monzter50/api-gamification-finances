import type { Response, NextFunction } from 'express';
import {
  type BudgetRequest,
  type CreateBudgetBody,
  type UpdateBudgetBody
} from '../types/budget.types';
import { budgetService } from '../services/budget.service';

/**
 * Budget Controller
 * Handles HTTP requests for budget operations
 */
export class BudgetController {
  /**
   * GET /api/budgets
   * Get all budgets for authenticated user
   */
  async getAllBudgets (req: BudgetRequest, res: Response, next: NextFunction): Promise<void> {
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
      next(error);
    }
  }

  /**
   * GET /api/budgets/:id
   * Get budget by ID
   */
  async getBudgetById (req: BudgetRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      const userId = req.user!.userId;
      const budget = await budgetService.getBudgetById(id, userId);

      res.status(200).json({
        success: true,
        data: budget,
        message: 'Budget retrieved successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/budgets
   * Create new budget
   */
  async createBudget (req: BudgetRequest<CreateBudgetBody>, res: Response, next: NextFunction): Promise<void> {
    try {
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
      next(error);
    }
  }

  /**
   * PUT /api/budgets/:id
   * Update entire budget
   */
  async updateBudget (req: BudgetRequest<UpdateBudgetBody>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

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
      next(error);
    }
  }

  /**
   * DELETE /api/budgets/:id
   * Delete budget
   */
  async deleteBudget (req: BudgetRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      const userId = req.user!.userId;
      await budgetService.deleteBudget(id, userId);

      res.status(200).json({
        success: true,
        message: 'Budget deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/budgets/:id/duplicate
   * Clone a budget (income + expense items only) into a new (year, month).
   *
   * Does NOT copy Transaction rows — those are historical and tied to the
   * SOURCE items by foreign key. The clone gets fresh items with new IDs.
   */
  async duplicateBudget (req: BudgetRequest<{ year: number, month: number }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

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
      next(error);
    }
  }

  /**
   * GET /api/budgets/stats
   * Get budget statistics for user
   */
  async getUserStats (req: BudgetRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const stats = await budgetService.getUserBudgetStats(userId);

      res.status(200).json({
        success: true,
        data: stats,
        message: 'Budget statistics retrieved successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

export const budgetController = new BudgetController();
