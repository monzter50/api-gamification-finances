import type { Response } from 'express';
import {
  type BudgetRequest,
  type AddExpenseItemBody,
  type UpdateExpenseItemsBody,
  type UpdateExpenseItemBody
} from '../types/budget.types';
import { budgetService } from '../services/budget.service';
import { logger } from '../config/logger';
import { validationResult } from 'express-validator';

export class ExpenseController {
  /**
   * GET /api/budgets/:id/expense
   * Get expense items from a budget (paginated)
   */
  async getExpenseItems (req: BudgetRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
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
        res.status(404).json({ success: false, error: 'Budget not found', statusCode: 404 });
        return;
      }
      res.status(500).json({ success: false, error: 'Error retrieving expense items', statusCode: 500 });
    }
  }

  /**
   * POST /api/budgets/:id/expense
   * Add a single expense item
   */
  async addExpenseItem (req: BudgetRequest<AddExpenseItemBody>, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation error', errors: errors.array(), statusCode: 400 });
      return;
    }

    try {
      const { id } = req.params;
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
        res.status(404).json({ success: false, error: errorMessage, statusCode: 404 });
        return;
      }
      if (errorMessage === 'Unauthorized access to budget') {
        res.status(403).json({ success: false, error: errorMessage, statusCode: 403 });
        return;
      }
      res.status(400).json({ success: false, error: errorMessage, statusCode: 400 });
    }
  }

  /**
   * PATCH /api/budgets/:id/expense
   * Replace all expense items
   */
  async updateExpenseItems (req: BudgetRequest<UpdateExpenseItemsBody>, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation error', errors: errors.array(), statusCode: 400 });
      return;
    }

    try {
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
        res.status(404).json({ success: false, error: errorMessage, statusCode: 404 });
        return;
      }
      if (errorMessage === 'Unauthorized access to budget') {
        res.status(403).json({ success: false, error: errorMessage, statusCode: 403 });
        return;
      }
      res.status(400).json({ success: false, error: errorMessage, statusCode: 400 });
    }
  }

  /**
   * PUT /api/budgets/:id/expense/:expenseId
   * Update a single expense item
   */
  async updateExpenseItem (req: BudgetRequest<UpdateExpenseItemBody>, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation error', errors: errors.array(), statusCode: 400 });
      return;
    }

    try {
      const { id, expenseId } = req.params;
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
      if (errorMessage === 'Budget not found' || errorMessage === 'Expense item not found') {
        res.status(404).json({ success: false, error: errorMessage, statusCode: 404 });
        return;
      }
      if (errorMessage === 'Unauthorized access to budget') {
        res.status(403).json({ success: false, error: errorMessage, statusCode: 403 });
        return;
      }
      res.status(400).json({ success: false, error: errorMessage, statusCode: 400 });
    }
  }

  /**
   * DELETE /api/budgets/:id/expense/:expenseId
   * Delete a single expense item
   */
  async deleteExpenseItem (req: BudgetRequest, res: Response): Promise<void> {
    try {
      const { id, expenseId } = req.params;
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
        res.status(404).json({ success: false, error: errorMessage, statusCode: 404 });
        return;
      }
      if (errorMessage === 'Unauthorized access to budget') {
        res.status(403).json({ success: false, error: errorMessage, statusCode: 403 });
        return;
      }
      res.status(500).json({ success: false, error: 'Error deleting expense item', statusCode: 500 });
    }
  }
}

export const expenseController = new ExpenseController();
