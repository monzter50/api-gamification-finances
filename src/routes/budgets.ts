import express from 'express';
import { budgetController } from '../controllers/budget.controller';
import { incomeController } from '../controllers/income.controller';
import { expenseController } from '../controllers/expense.controller';
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
  incomeController.getIncomeItems.bind(incomeController)
);

// Add a single income item
router.post(
  '/:id/income',
  authenticateJWT,
  addIncomeItemValidation,
  validate,
  incomeController.addIncomeItem.bind(incomeController)
);

// Update/replace all income items
router.patch(
  '/:id/income',
  authenticateJWT,
  updateIncomeItemsValidation,
  validate,
  incomeController.updateIncomeItems.bind(incomeController)
);

// Update specific income item
router.put(
  '/:id/income/:incomeId',
  authenticateJWT,
  updateIncomeItemValidation,
  validate,
  incomeController.updateIncomeItem.bind(incomeController)
);

// Delete specific income item
router.delete(
  '/:id/income/:incomeId',
  authenticateJWT,
  deleteIncomeItemValidation,
  validate,
  incomeController.deleteIncomeItem.bind(incomeController)
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
  expenseController.getExpenseItems.bind(expenseController)
);

// Add a single expense item
router.post(
  '/:id/expense',
  authenticateJWT,
  addExpenseItemValidation,
  validate,
  expenseController.addExpenseItem.bind(expenseController)
);

// Update/replace all expense items
router.patch(
  '/:id/expense',
  authenticateJWT,
  updateExpenseItemsValidation,
  validate,
  expenseController.updateExpenseItems.bind(expenseController)
);

// Update specific expense item
router.put(
  '/:id/expense/:expenseId',
  authenticateJWT,
  updateExpenseItemValidation,
  validate,
  expenseController.updateExpenseItem.bind(expenseController)
);

// Delete specific expense item
router.delete(
  '/:id/expense/:expenseId',
  authenticateJWT,
  deleteExpenseItemValidation,
  validate,
  expenseController.deleteExpenseItem.bind(expenseController)
);

export { router as budgetRoutes };
