import express from 'express';
import type { Request, Response } from 'express';
import { authRoutes } from './auth';
import { userRoutes } from './users';
import { transactionRoutes } from './transactions';
import { achievementRoutes } from './achievements';
import { gamificationRoutes } from './gamification';
import { badgeRoutes } from './badges';
import { budgetRoutes } from './budgets';

const router = express.Router();

// API version prefix
const API_VERSION = process.env.API_VERSION || 'v1';

// Health check route
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'API de Gamificación de Finanzas funcionando correctamente',
    version: API_VERSION,
    timestamp: new Date().toISOString()
  });
});

// API documentation route
router.get('/docs', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Documentación de la API de Gamificación de Finanzas',
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
        'PUT /users/profile': 'Actualizar perfil del usuario',
        'GET /users/stats': 'Obtener estadísticas del usuario'
      },
      transactions: {
        'GET /transactions': 'Obtener todas las transacciones del usuario',
        'POST /transactions': 'Crear nueva transacción',
        'GET /transactions/:id': 'Obtener transacción específica',
        'PUT /transactions/:id': 'Actualizar transacción',
        'DELETE /transactions/:id': 'Eliminar transacción',
        'GET /transactions/summary': 'Obtener resumen financiero',
        'GET /transactions/monthly/:year/:month': 'Obtener resumen mensual'
      },
      achievements: {
        'GET /achievements': 'Obtener todos los logros',
        'GET /achievements/user': 'Obtener logros del usuario',
        'POST /achievements/:id/unlock': 'Desbloquear logro',
        'GET /achievements/:id/progress': 'Obtener progreso del logro'
      },
      gamification: {
        'GET /gamification/profile': 'Obtener perfil de gamificación',
        'POST /gamification/level-up': 'Subir de nivel',
        'GET /gamification/leaderboard': 'Obtener tabla de clasificación',
        'GET /gamification/progress': 'Obtener estadísticas de progreso',
        'POST /gamification/add-coins': 'Añadir monedas (testing)'
      },
      badges: {
        'GET /badges/active': 'Get all active badges',
        'GET /badges/available': 'Get all available badges',
        'GET /badges/user': 'Get user badges',
        'GET /badges/stats': 'Get badge statistics',
        'POST /badges/check-unlock': 'Check and award unlockable badges',
        'GET /badges/category/:category': 'Get badges by category',
        'GET /badges/rarity/:rarity': 'Get badges by rarity',
        'GET /badges/:badgeId': 'Get badge by ID',
        'POST /badges': 'Create new badge (admin)',
        'PUT /badges/:badgeId': 'Update badge (admin)',
        'DELETE /badges/:badgeId': 'Delete badge (admin)'
      },
      budgets: {
        'GET /budgets': 'Get all budgets (with optional year/month filters)',
        'GET /budgets/stats': 'Get budget statistics',
        'GET /budgets/:id': 'Get budget by ID',
        'POST /budgets': 'Create new budget',
        'PUT /budgets/:id': 'Update budget',
        'DELETE /budgets/:id': 'Delete budget',
        'PATCH /budgets/:id/income': 'Update income items',
        'DELETE /budgets/:id/income/:itemId': 'Delete income item',
        'PATCH /budgets/:id/expense': 'Update expense items',
        'DELETE /budgets/:id/expense/:itemId': 'Delete expense item'
      }
    }
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/transactions', transactionRoutes);
router.use('/achievements', achievementRoutes);
router.use('/gamification', gamificationRoutes);
router.use('/badges', badgeRoutes);
router.use('/budgets', budgetRoutes);

export { router as routes }; 