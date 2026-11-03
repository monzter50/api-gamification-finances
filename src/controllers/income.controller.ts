import type { Response, NextFunction } from 'express';
import {
  type BudgetRequest,
  type AddIncomeItemBody,
  type UpdateIncomeItemsBody,
  type UpdateIncomeItemBody
} from '../types/budget.types';
import { budgetService } from '../services/budget.service';

export class IncomeController {
  /**
   * GET /api/budgets/:id/income
   * Get income items from a budget (paginated)
   */
  async getIncomeItems (req: BudgetRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
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
      next(error);
    }
  }

  /**
   * POST /api/budgets/:id/income
   * Add a single income item
   */
  async addIncomeItem (req: BudgetRequest<AddIncomeItemBody>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = req.user!.userId;
      const { description, amount, type, accountId } = req.body;

      const result = await budgetService.addIncomeItem(id, userId, { description, amount, type, accountId });

      res.status(201).json({
        success: true,
        data: result,
        message: 'Income item added successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/budgets/:id/income
   * Replace all income items
   */
  async updateIncomeItems (req: BudgetRequest<UpdateIncomeItemsBody>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = req.user!.userId;
      const { incomeItems } = req.body;

      const budget = await budgetService.updateIncomeItems(id, userId, incomeItems);

      res.status(200).json({
        success: true,
        data: budget,
        message: 'Income items updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/budgets/:id/income/:incomeId
   * Update a single income item
   */
  async updateIncomeItem (req: BudgetRequest<UpdateIncomeItemBody>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { incomeId } = req.params as { incomeId: string };
      const userId = req.user!.userId;
      const { description, amount, type, accountId } = req.body;

      const result = await budgetService.updateIncomeItem(id, userId, incomeId, { description, amount, type, accountId });

      res.status(200).json({
        success: true,
        data: result,
        message: 'Income item updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/budgets/:id/income/:incomeId
   * Delete a single income item
   */
  async deleteIncomeItem (req: BudgetRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { incomeId } = req.params as { incomeId: string };
      const userId = req.user!.userId;

      const result = await budgetService.removeIncomeItem(id, userId, incomeId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Income item deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

export const incomeController = new IncomeController();
