import type { Response, NextFunction } from 'express';
import {
  type BudgetRequest,
  type AddExpenseItemBody,
  type UpdateExpenseItemsBody,
  type UpdateExpenseItemBody
} from '../types/budget.types';
import { budgetService } from '../services/budget.service';

export class ExpenseController {
  /**
   * GET /api/budgets/:id/expense
   * Get expense items from a budget (paginated)
   */
  async getExpenseItems (req: BudgetRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
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
      next(error);
    }
  }

  /**
   * POST /api/budgets/:id/expense
   * Add a single expense item
   */
  async addExpenseItem (req: BudgetRequest<AddExpenseItemBody>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = req.user!.userId;
      const { description, amount, type } = req.body;

      const result = await budgetService.addExpenseItem(id, userId, { description, amount, type });

      res.status(201).json({
        success: true,
        data: result,
        message: 'Expense item added successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/budgets/:id/expense
   * Replace all expense items
   */
  async updateExpenseItems (req: BudgetRequest<UpdateExpenseItemsBody>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = req.user!.userId;
      const { expenseItems } = req.body;

      const budget = await budgetService.updateExpenseItems(id, userId, expenseItems);

      res.status(200).json({
        success: true,
        data: budget,
        message: 'Expense items updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/budgets/:id/expense/:expenseId
   * Update a single expense item
   */
  async updateExpenseItem (req: BudgetRequest<UpdateExpenseItemBody>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, expenseId } = req.params as { id: string; expenseId: string };
      const userId = req.user!.userId;
      const { description, amount, type } = req.body;

      const result = await budgetService.updateExpenseItem(id, userId, expenseId, { description, amount, type });

      res.status(200).json({
        success: true,
        data: result,
        message: 'Expense item updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/budgets/:id/expense/:expenseId
   * Delete a single expense item
   */
  async deleteExpenseItem (req: BudgetRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, expenseId } = req.params as { id: string; expenseId: string };
      const userId = req.user!.userId;

      const result = await budgetService.removeExpenseItem(id, userId, expenseId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Expense item deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

export const expenseController = new ExpenseController();
