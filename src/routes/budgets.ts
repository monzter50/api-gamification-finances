import express from 'express';
import { budgetController } from '../controllers/budget.controller';
import { authenticateJWT } from './auth';
import { validate } from '../middleware/validate';
import {
  createBudgetValidation,
  updateBudgetValidation,
  updateIncomeItemsValidation,
  updateExpenseItemsValidation,
  budgetIdValidation,
  itemIdValidation,
  budgetQueryValidation
} from '../validators/budget.validator';

const router = express.Router();

/**
 * Base Budget Routes
 * Base URL: /api/budgets
 */

// Get budget statistics
router.get(
  '/stats',
  authenticateJWT,
  budgetController.getUserStats.bind(budgetController)
);

// Get all budgets (with optional filters)
router.get(
  '/',
  authenticateJWT,
  budgetQueryValidation,
  validate,
  budgetController.getAllBudgets.bind(budgetController)
);

// Get budget by ID
router.get(
  '/:id',
  authenticateJWT,
  budgetIdValidation,
  validate,
  budgetController.getBudgetById.bind(budgetController)
);

// Create new budget
router.post(
  '/',
  authenticateJWT,
  createBudgetValidation,
  validate,
  budgetController.createBudget.bind(budgetController)
);

// Update budget
router.put(
  '/:id',
  authenticateJWT,
  updateBudgetValidation,
  validate,
  budgetController.updateBudget.bind(budgetController)
);

// Delete budget
router.delete(
  '/:id',
  authenticateJWT,
  budgetIdValidation,
  validate,
  budgetController.deleteBudget.bind(budgetController)
);

/**
 * Nested Income Routes
 * Base URL: /api/budgets/:id/income
 */

// Update/replace all income items
router.patch(
  '/:id/income',
  authenticateJWT,
  updateIncomeItemsValidation,
  validate,
  budgetController.updateIncomeItems.bind(budgetController)
);

// Delete specific income item
router.delete(
  '/:id/income/:itemId',
  authenticateJWT,
  itemIdValidation,
  validate,
  budgetController.deleteIncomeItem.bind(budgetController)
);

/**
 * Nested Expense Routes
 * Base URL: /api/budgets/:id/expense
 */

// Update/replace all expense items
router.patch(
  '/:id/expense',
  authenticateJWT,
  updateExpenseItemsValidation,
  validate,
  budgetController.updateExpenseItems.bind(budgetController)
);

// Delete specific expense item
router.delete(
  '/:id/expense/:itemId',
  authenticateJWT,
  itemIdValidation,
  validate,
  budgetController.deleteExpenseItem.bind(budgetController)
);

export { router as budgetRoutes };
