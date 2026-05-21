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
  deleteExpenseItemValidation,
  duplicateBudgetValidation
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

/**
 * @openapi
 * /api/budgets/{id}:
 *   put:
 *     tags: [Budgets]
 *     summary: Update budget scalar fields (year, month)
 *     description: |
 *       Updates ONLY the budget's own scalar fields. Income and expense items
 *       **must** be managed via the dedicated nested endpoints:
 *
 *       - `/api/budgets/{id}/income` — add, update, or delete income items
 *       - `/api/budgets/{id}/expense` — add, update, or delete expense items
 *
 *       Sending `incomeItems` or `expenseItems` in this body returns `400`.
 *       Rationale: bulk-replacing items would delete rows referenced by
 *       Transaction.incomeItemId / expenseItemId, breaking transaction history.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             properties:
 *               year:  { type: integer, minimum: 2000, maximum: 2100, example: 2026 }
 *               month: { type: integer, minimum: 0, maximum: 11, example: 3 }
 *           example:
 *             year: 2026
 *             month: 3
 *     responses:
 *       200:
 *         description: Budget updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:    { type: object, description: Updated budget }
 *                 message: { type: string, example: 'Budget updated successfully' }
 *       400: { $ref: '#/components/responses/BadRequestError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 */
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
 * @openapi
 * /api/budgets/{id}/duplicate:
 *   post:
 *     tags: [Budgets]
 *     summary: Duplicate a budget into a new (year, month)
 *     description: |
 *       Clones the source budget's `incomeItems` and `expenseItems` into a
 *       brand-new budget at the target `year`/`month`. **Transactions are NOT
 *       copied** — they are historical records pointing at the SOURCE items,
 *       and the cloned items are new rows with new IDs. Copying them would
 *       break transaction history.
 *
 *       Fails with:
 *       - `400` if the target month is out of range, or if any source income
 *         item references an account that no longer belongs to the user
 *         (error message lists the offending accountIds).
 *       - `403` if the source budget does not belong to the caller.
 *       - `404` if the source budget does not exist.
 *       - `409` if a budget already exists at the target `(year, month)`.
 *
 *       Items are NOT accepted in the body — pass only the target period.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Source budget ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [year, month]
 *             additionalProperties: false
 *             properties:
 *               year:  { type: integer, minimum: 2000, maximum: 2100, example: 2026 }
 *               month: { type: integer, minimum: 0, maximum: 11, example: 6, description: '0-indexed (0 = January, 11 = December)' }
 *           example:
 *             year: 2026
 *             month: 6
 *     responses:
 *       201:
 *         description: Budget duplicated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:    { type: object, description: 'The newly created budget with cloned incomeItems and expenseItems' }
 *                 message: { type: string, example: 'Budget duplicated successfully' }
 *       400: { $ref: '#/components/responses/BadRequestError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403:
 *         description: Source budget does not belong to the caller
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       409:
 *         description: A budget already exists for the target period
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *             example:
 *               success: false
 *               error: 'Budget for 2026-7 already exists'
 *               statusCode: 409
 */
router.post(
  '/:id/duplicate',
  authenticateJWT,
  duplicateBudgetValidation,
  validate,
  budgetController.duplicateBudget.bind(budgetController)
);

/**
 * Nested Income Routes
 * Base URL: /api/budgets/:id/income
 */

/**
 * @openapi
 * /api/budgets/{id}/income:
 *   get:
 *     tags: [Income]
 *     summary: List income items (paginated)
 *     description: Returns the paginated income items for the given budget, plus the user's accounts (useful to resolve `accountId`).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Budget ID
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *     responses:
 *       200:
 *         description: Income items retrieved successfully
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PaginatedIncomeResponse' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 */
router.get(
  '/:id/income',
  authenticateJWT,
  budgetIdValidation,
  validate,
  incomeController.getIncomeItems.bind(incomeController)
);

/**
 * @openapi
 * /api/budgets/{id}/income:
 *   post:
 *     tags: [Income]
 *     summary: Add a single income item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AddIncomeItemRequest' }
 *           example:
 *             description: Monthly salary
 *             amount: 25000
 *             type: Transfer
 *             accountId: acc_01HX5A2B3C4D5E6F
 *     responses:
 *       201:
 *         description: Income item added successfully
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/IncomeItemMutationResponse' }
 *       400: { $ref: '#/components/responses/BadRequestError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403:
 *         description: Unauthorized access to budget
 *       404: { $ref: '#/components/responses/NotFoundError' }
 */
router.post(
  '/:id/income',
  authenticateJWT,
  addIncomeItemValidation,
  validate,
  incomeController.addIncomeItem.bind(incomeController)
);

/**
 * @openapi
 * /api/budgets/{id}/income:
 *   patch:
 *     tags: [Income]
 *     summary: Replace all income items for this budget
 *     description: Overwrites the full income list. To add/update a single item, prefer POST or PUT.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateIncomeItemsRequest' }
 *     responses:
 *       200:
 *         description: Income items updated successfully
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/BudgetMutationResponse' }
 *       400: { $ref: '#/components/responses/BadRequestError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403:
 *         description: Unauthorized access to budget
 *       404: { $ref: '#/components/responses/NotFoundError' }
 */
router.patch(
  '/:id/income',
  authenticateJWT,
  updateIncomeItemsValidation,
  validate,
  incomeController.updateIncomeItems.bind(incomeController)
);

/**
 * @openapi
 * /api/budgets/{id}/income/{incomeId}:
 *   put:
 *     tags: [Income]
 *     summary: Update a single income item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Budget ID
 *       - in: path
 *         name: incomeId
 *         required: true
 *         schema: { type: string }
 *         description: Income item ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AddIncomeItemRequest' }
 *     responses:
 *       200:
 *         description: Income item updated successfully
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/IncomeItemMutationResponse' }
 *       400: { $ref: '#/components/responses/BadRequestError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403:
 *         description: Unauthorized access to budget
 *       404: { $ref: '#/components/responses/NotFoundError' }
 */
router.put(
  '/:id/income/:incomeId',
  authenticateJWT,
  updateIncomeItemValidation,
  validate,
  incomeController.updateIncomeItem.bind(incomeController)
);

/**
 * @openapi
 * /api/budgets/{id}/income/{incomeId}:
 *   delete:
 *     tags: [Income]
 *     summary: Delete a single income item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: incomeId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Income item deleted successfully
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ItemRemovalResponse' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403:
 *         description: Unauthorized access to budget
 *       404: { $ref: '#/components/responses/NotFoundError' }
 */
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

/**
 * @openapi
 * /api/budgets/{id}/expense:
 *   get:
 *     tags: [Expense]
 *     summary: List expense items (paginated)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Budget ID
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *     responses:
 *       200:
 *         description: Expense items retrieved successfully
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PaginatedExpenseResponse' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 */
router.get(
  '/:id/expense',
  authenticateJWT,
  budgetIdValidation,
  validate,
  expenseController.getExpenseItems.bind(expenseController)
);

/**
 * @openapi
 * /api/budgets/{id}/expense:
 *   post:
 *     tags: [Expense]
 *     summary: Add a single expense item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AddExpenseItemRequest' }
 *           example:
 *             description: Rent
 *             amount: 1200
 *             type: Fixed
 *     responses:
 *       201:
 *         description: Expense item added successfully
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ExpenseItemMutationResponse' }
 *       400: { $ref: '#/components/responses/BadRequestError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403:
 *         description: Unauthorized access to budget
 *       404: { $ref: '#/components/responses/NotFoundError' }
 */
router.post(
  '/:id/expense',
  authenticateJWT,
  addExpenseItemValidation,
  validate,
  expenseController.addExpenseItem.bind(expenseController)
);

/**
 * @openapi
 * /api/budgets/{id}/expense:
 *   patch:
 *     tags: [Expense]
 *     summary: Replace all expense items for this budget
 *     description: Overwrites the full expense list. To add/update a single item, prefer POST or PUT.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateExpenseItemsRequest' }
 *     responses:
 *       200:
 *         description: Expense items updated successfully
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/BudgetMutationResponse' }
 *       400: { $ref: '#/components/responses/BadRequestError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403:
 *         description: Unauthorized access to budget
 *       404: { $ref: '#/components/responses/NotFoundError' }
 */
router.patch(
  '/:id/expense',
  authenticateJWT,
  updateExpenseItemsValidation,
  validate,
  expenseController.updateExpenseItems.bind(expenseController)
);

/**
 * @openapi
 * /api/budgets/{id}/expense/{expenseId}:
 *   put:
 *     tags: [Expense]
 *     summary: Update a single expense item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Budget ID
 *       - in: path
 *         name: expenseId
 *         required: true
 *         schema: { type: string }
 *         description: Expense item ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AddExpenseItemRequest' }
 *     responses:
 *       200:
 *         description: Expense item updated successfully
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ExpenseItemMutationResponse' }
 *       400: { $ref: '#/components/responses/BadRequestError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403:
 *         description: Unauthorized access to budget
 *       404: { $ref: '#/components/responses/NotFoundError' }
 */
router.put(
  '/:id/expense/:expenseId',
  authenticateJWT,
  updateExpenseItemValidation,
  validate,
  expenseController.updateExpenseItem.bind(expenseController)
);

/**
 * @openapi
 * /api/budgets/{id}/expense/{expenseId}:
 *   delete:
 *     tags: [Expense]
 *     summary: Delete a single expense item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: expenseId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Expense item deleted successfully
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ItemRemovalResponse' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403:
 *         description: Unauthorized access to budget
 *       404: { $ref: '#/components/responses/NotFoundError' }
 */
router.delete(
  '/:id/expense/:expenseId',
  authenticateJWT,
  deleteExpenseItemValidation,
  validate,
  expenseController.deleteExpenseItem.bind(expenseController)
);

export { router as budgetRoutes };
