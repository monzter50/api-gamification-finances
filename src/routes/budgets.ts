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
  budgetQueryValidation,
  addIncomeItemValidation,
  addExpenseItemValidation,
  updateIncomeItemValidation,
  updateExpenseItemValidation,
  deleteIncomeItemValidation,
  deleteExpenseItemValidation
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

// Get income items (with pagination)
router.get(
  '/:id/income',
  authenticateJWT,
  budgetIdValidation,
  validate,
  budgetController.getIncomeItems.bind(budgetController)
);

// Add a single income item
router.post(
  '/:id/income',
  authenticateJWT,
  addIncomeItemValidation,
  validate,
  budgetController.addIncomeItem.bind(budgetController)
);

// Update/replace all income items
router.patch(
  '/:id/income',
  authenticateJWT,
  updateIncomeItemsValidation,
  validate,
  budgetController.updateIncomeItems.bind(budgetController)
);

// Update specific income item
router.put(
  '/:id/income/:incomeId',
  authenticateJWT,
  updateIncomeItemValidation,
  validate,
  budgetController.updateIncomeItem.bind(budgetController)
);

// Delete specific income item
router.delete(
  '/:id/income/:incomeId',
  authenticateJWT,
  deleteIncomeItemValidation,
  validate,
  budgetController.deleteIncomeItem.bind(budgetController)
);

/**
 * Nested Expense Routes
 * Base URL: /api/budgets/:id/expense
 */

// Get expense items (with pagination)
router.get(
  '/:id/expense',
  authenticateJWT,
  budgetIdValidation,
  validate,
  budgetController.getExpenseItems.bind(budgetController)
);

// Add a single expense item
router.post(
  '/:id/expense',
  authenticateJWT,
  addExpenseItemValidation,
  validate,
  budgetController.addExpenseItem.bind(budgetController)
);

// Update/replace all expense items
router.patch(
  '/:id/expense',
  authenticateJWT,
  updateExpenseItemsValidation,
  validate,
  budgetController.updateExpenseItems.bind(budgetController)
);

// Update specific expense item
router.put(
  '/:id/expense/:expenseId',
  authenticateJWT,
  updateExpenseItemValidation,
  validate,
  budgetController.updateExpenseItem.bind(budgetController)
);

// Delete specific expense item
router.delete(
  '/:id/expense/:expenseId',
  authenticateJWT,
  deleteExpenseItemValidation,
  validate,
  budgetController.deleteExpenseItem.bind(budgetController)
);

export { router as budgetRoutes };
