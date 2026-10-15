import express from 'express';
import type { Request, Response } from 'express';
import { authRoutes } from './auth';
import { userRoutes } from './users';
import { transactionRoutes } from './transactions';
import { budgetRoutes } from './budgets';
import { accountRoutes } from './accounts';
import { isApiDocsEnabled } from '../config/env';

const router = express.Router();

// API version prefix
const API_VERSION = process.env.API_VERSION || 'v1';

// Health check route
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'API de Gamificación de Finanzas funcionando correctamente',
    version: API_VERSION,
    timestamp: new Date().toISOString()
  });
});

// API documentation route (human-readable endpoint index). Gated like the
// Swagger UI: off in production unless ENABLE_API_DOCS=true.
if (isApiDocsEnabled()) {
  router.get('/docs', (_req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'Documentación de la API de Finanzas',
      version: API_VERSION,
      endpoints: {
        auth: {
          'POST /auth/register': 'Registrar nuevo usuario',
          'POST /auth/login': 'Iniciar sesión',
          'POST /auth/logout': 'Cerrar sesión',
          'GET /auth/me': 'Obtener perfil del usuario actual'
        },
        users: {
          'GET /users/profile': 'Obtener perfil del usuario',
          'PUT /users/profile': 'Actualizar perfil del usuario'
        },
        accounts: {
          'GET /accounts': 'List accounts',
          'POST /accounts': 'Create account',
          'GET /accounts/:id': 'Get account by ID',
          'PUT /accounts/:id': 'Update account',
          'DELETE /accounts/:id': 'Delete account (409 if it has transactions)'
        },
        transactions: {
          'GET /transactions': 'Get all transactions (paginated, with optional filters)',
          'POST /transactions': 'Create new transaction (moves the account balance)',
          'GET /transactions/summary': 'Get financial summary',
          'GET /transactions/monthly/:year/:month': 'Get monthly summary with category breakdown',
          'GET /transactions/budget/:budgetId/balance': 'Get budget balance breakdown',
          'POST /transactions/import/xlsx/parse': 'Parse an .xlsx workbook (no writes)',
          'POST /transactions/import/xlsx/confirm': 'Import the reviewed rows',
          'GET /transactions/:id': 'Get transaction by ID',
          'PUT /transactions/:id': 'Update transaction',
          'DELETE /transactions/:id': 'Delete transaction (reverses the balance)'
        },
        budgets: {
          'GET /budgets': 'Get all budgets (with optional year/month filters)',
          'GET /budgets/stats': 'Get budget statistics',
          'GET /budgets/:id': 'Get budget by ID',
          'POST /budgets': 'Create new budget',
          'PUT /budgets/:id': 'Update budget (year/month only)',
          'DELETE /budgets/:id': 'Delete budget',
          'POST /budgets/:id/duplicate': 'Duplicate a budget into another month',
          'GET /budgets/:id/income': 'List income items (paginated)',
          'POST /budgets/:id/income': 'Add income item',
          'PATCH /budgets/:id/income': 'Replace all income items',
          'PUT /budgets/:id/income/:incomeId': 'Update income item',
          'DELETE /budgets/:id/income/:incomeId': 'Delete income item',
          'GET /budgets/:id/expense': 'List expense items (paginated)',
          'POST /budgets/:id/expense': 'Add expense item',
          'PATCH /budgets/:id/expense': 'Replace all expense items',
          'PUT /budgets/:id/expense/:expenseId': 'Update expense item',
          'DELETE /budgets/:id/expense/:expenseId': 'Delete expense item'
        }
      }
    });
  });
}

// Mount route modules
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/transactions', transactionRoutes);
router.use('/budgets', budgetRoutes);
router.use('/accounts', accountRoutes);

export { router as routes };
