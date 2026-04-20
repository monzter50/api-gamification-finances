import type { Response } from 'express';
import {
  type BudgetRequest,
  type AddIncomeItemBody,
  type UpdateIncomeItemsBody,
  type UpdateIncomeItemBody
} from '../types/budget.types';
import { budgetService } from '../services/budget.service';
import { logger } from '../config/logger';
import { validationResult } from 'express-validator';

export class IncomeController {
  /**
   * GET /api/budgets/:id/income
   * Get income items from a budget (paginated)
   */
  async getIncomeItems (req: BudgetRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
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
        res.status(404).json({ success: false, error: 'Budget not found', statusCode: 404 });
        return;
      }
      res.status(500).json({ success: false, error: 'Error retrieving income items', statusCode: 500 });
    }
  }

  /**
   * POST /api/budgets/:id/income
   * Add a single income item
   */
  async addIncomeItem (req: BudgetRequest<AddIncomeItemBody>, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation error', errors: errors.array(), statusCode: 400 });
      return;
    }

    try {
      const id = req.params.id as string;
      const userId = req.user!.userId;
      const { description, amount, type, accountId } = req.body;

      const result = await budgetService.addIncomeItem(id, userId, { description, amount, type, accountId });

      res.status(201).json({
        success: true,
        data: result,
        message: 'Income item added successfully'
      });
    } catch (error) {
      logger.error('Error adding income item:', error);
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
   * PATCH /api/budgets/:id/income
   * Replace all income items
   */
  async updateIncomeItems (req: BudgetRequest<UpdateIncomeItemsBody>, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation error', errors: errors.array(), statusCode: 400 });
      return;
    }

    try {
      const id = req.params.id as string;
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
   * PUT /api/budgets/:id/income/:incomeId
   * Update a single income item
   */
  async updateIncomeItem (req: BudgetRequest<UpdateIncomeItemBody>, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation error', errors: errors.array(), statusCode: 400 });
      return;
    }

    try {
      const id = req.params.id as string;
      const incomeId = req.params.incomeId as string;
      const userId = req.user!.userId;
      const { description, amount, type, accountId } = req.body;

      const result = await budgetService.updateIncomeItem(id, userId, incomeId, { description, amount, type, accountId });

      res.status(200).json({
        success: true,
        data: result,
        message: 'Income item updated successfully'
      });
    } catch (error) {
      logger.error('Error updating income item:', error);
      const errorMessage = (error as Error).message;
      if (errorMessage === 'Budget not found' || errorMessage === 'Income item not found') {
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
   * DELETE /api/budgets/:id/income/:incomeId
   * Delete a single income item
   */
  async deleteIncomeItem (req: BudgetRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const incomeId = req.params.incomeId as string;
      const userId = req.user!.userId;

      const result = await budgetService.removeIncomeItem(id, userId, incomeId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Income item deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting income item:', error);
      const errorMessage = (error as Error).message;
      if (errorMessage === 'Budget not found') {
        res.status(404).json({ success: false, error: errorMessage, statusCode: 404 });
        return;
      }
      if (errorMessage === 'Unauthorized access to budget') {
        res.status(403).json({ success: false, error: errorMessage, statusCode: 403 });
        return;
      }
      res.status(500).json({ success: false, error: 'Error deleting income item', statusCode: 500 });
    }
  }
}

export const incomeController = new IncomeController();
