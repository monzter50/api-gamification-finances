import express from 'express';
import type { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { authenticateJWT } from './auth';
import { logger } from '../config/logger';
import { userProfileRepository } from '../repositories/userProfile.repository';

const router = express.Router();

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: Obtener todas las transacciones del usuario
 *     description: Retorna todas las transacciones del usuario autenticado
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de transacciones obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Transaction'
 *                 status:
 *                   type: string
 *                   example: ok
 *                 statusCode:
 *                   type: number
 *                   example: 200
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Error interno del servidor
 */
// Get all transactions for user
router.get('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // TODO: Implement when Transaction model is created
    res.status(200).json({
      success: true,
      message: 'Endpoint en desarrollo - Modelo de transacciones pendiente',
      data: []
    });
  } catch (error) {
    logger.error('Error getting transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las transacciones'
    });
  }
});

/**
 * @swagger
 * /api/transactions:
 *   post:
 *     summary: Crear una nueva transacción
 *     description: Crea una nueva transacción para el usuario autenticado
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTransactionRequest'
 *           example:
 *             type: expense
 *             category: Food
 *             amount: 150.50
 *             description: Grocery shopping at supermarket
 *             date: '2025-12-29'
 *     responses:
 *       201:
 *         description: Transacción creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   $ref: '#/components/schemas/Transaction'
 *                 status:
 *                   type: string
 *                   example: ok
 *                 statusCode:
 *                   type: number
 *                   example: 201
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Create new transaction
router.post('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { type, category, amount, description, date } = req.body;

    if (!type || !category || !amount || !description) {
      res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: type, category, amount, description'
      });
      return;
    }

    if (!['income', 'expense', 'savings'].includes(type)) {
      res.status(400).json({
        success: false,
        message: 'Tipo de transacción inválido. Debe ser: income, expense, o savings'
      });
      return;
    }

    if (typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({
        success: false,
        message: 'El monto debe ser un número positivo'
      });
      return;
    }

    // TODO: Implement when Transaction model is created
    res.status(201).json({
      success: true,
      message: 'Transacción creada correctamente (endpoint en desarrollo)',
      data: {
        id: 'temp-id',
        type,
        category,
        amount,
        description,
        date: date || new Date(),
        userId: req.user?.id
      }
    });
  } catch (error) {
    logger.error('Error creating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear la transacción'
    });
  }
});

/**
 * @swagger
 * /api/transactions/{id}:
 *   get:
 *     summary: Obtener transacción por ID
 *     description: Retorna una transacción específica del usuario autenticado
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la transacción
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Transacción obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   $ref: '#/components/schemas/Transaction'
 *                 status:
 *                   type: string
 *                   example: ok
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
// Get specific transaction
router.get('/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // TODO: Implement when Transaction model is created
    res.status(200).json({
      success: true,
      message: 'Endpoint en desarrollo - Modelo de transacciones pendiente',
      data: {
        id,
        type: 'expense',
        category: 'General',
        amount: 0,
        description: 'Transacción de ejemplo',
        date: new Date()
      }
    });
  } catch (error) {
    logger.error('Error getting transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la transacción'
    });
  }
});

/**
 * @swagger
 * /api/transactions/{id}:
 *   put:
 *     summary: Actualizar transacción
 *     description: Actualiza una transacción existente del usuario autenticado
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la transacción
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [income, expense, savings]
 *               category:
 *                 type: string
 *               amount:
 *                 type: number
 *               description:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *           example:
 *             amount: 200.00
 *             description: Updated description
 *     responses:
 *       200:
 *         description: Transacción actualizada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   $ref: '#/components/schemas/Transaction'
 *                 status:
 *                   type: string
 *                   example: ok
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
// Update transaction
router.put('/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { type, category, amount, description, date } = req.body;

    // TODO: Implement when Transaction model is created
    res.status(200).json({
      success: true,
      message: 'Transacción actualizada correctamente (endpoint en desarrollo)',
      data: {
        id,
        type: type || 'expense',
        category: category || 'General',
        amount: amount || 0,
        description: description || 'Transacción actualizada',
        date: date || new Date()
      }
    });
  } catch (error) {
    logger.error('Error updating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar la transacción'
    });
  }
});

/**
 * @swagger
 * /api/transactions/{id}:
 *   delete:
 *     summary: Eliminar transacción
 *     description: Elimina una transacción del usuario autenticado
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la transacción
 *     responses:
 *       204:
 *         description: Transacción eliminada exitosamente
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
// Delete transaction
router.delete('/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // TODO: Implement when Transaction model is created
    res.status(200).json({
      success: true,
      message: 'Transacción eliminada correctamente (endpoint en desarrollo)',
      data: { id }
    });
  } catch (error) {
    logger.error('Error deleting transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar la transacción'
    });
  }
});

/**
 * @swagger
 * /api/transactions/summary:
 *   get:
 *     summary: Obtener resumen financiero
 *     description: Retorna un resumen de todas las transacciones del usuario
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resumen obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   $ref: '#/components/schemas/TransactionSummary'
 *                 status:
 *                   type: string
 *                   example: ok
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Get financial summary
router.get('/summary', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    const profile = await userProfileRepository.findByUserId(userId);

    // TODO: Calculate from actual transactions when model is created
    const summary = {
      income: {
        total: 0,
        count: 0,
        experience: 0,
        coins: 0
      },
      expense: {
        total: profile?.totalExpenses || 0,
        count: 0,
        experience: 0,
        coins: 0
      },
      savings: {
        total: profile?.totalSavings || 0,
        count: 0,
        experience: 0,
        coins: 0
      },
      netWorth: (profile?.totalSavings || 0) - (profile?.totalExpenses || 0),
      savingsProgress: profile && profile.savingsGoal > 0
        ? Math.min((profile.totalSavings / profile.savingsGoal) * 100, 100)
        : 0
    };

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    logger.error('Error getting financial summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting financial summary'
    });
  }
});

/**
 * @swagger
 * /api/transactions/monthly/{year}/{month}:
 *   get:
 *     summary: Obtener resumen mensual
 *     description: Retorna un resumen de transacciones para un mes específico
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 2000
 *           maximum: 2100
 *         description: Año
 *         example: 2025
 *       - in: path
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 0
 *           maximum: 11
 *         description: Mes (0-11, donde 0 es Enero)
 *         example: 11
 *     responses:
 *       200:
 *         description: Resumen mensual obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   $ref: '#/components/schemas/TransactionSummary'
 *                 status:
 *                   type: string
 *                   example: ok
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Get monthly summary
router.get('/monthly/:year/:month', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { year, month } = req.params;
    const yearNum = parseInt(year || '0');
    const monthNum = parseInt(month || '0');

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      res.status(400).json({
        success: false,
        message: 'Año y mes inválidos'
      });
      return;
    }

    // TODO: Implement when Transaction model is created
    const monthlySummary = {
      year: yearNum,
      month: monthNum,
      income: {
        total: 0,
        count: 0,
        experience: 0,
        coins: 0
      },
      expense: {
        total: 0,
        count: 0,
        experience: 0,
        coins: 0
      },
      savings: {
        total: 0,
        count: 0,
        experience: 0,
        coins: 0
      },
      netWorth: 0,
      daysWithTransactions: 0
    };

    res.status(200).json({
      success: true,
      data: monthlySummary
    });
  } catch (error) {
    logger.error('Error getting monthly summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el resumen mensual'
    });
  }
});

export { router as transactionRoutes }; 