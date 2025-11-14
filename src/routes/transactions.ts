import express from 'express';
import type { Response } from 'express';
import { User } from '../models/User';
import { AuthenticatedRequest } from '../types';
import { authenticateJWT } from './auth';

const router = express.Router();

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
    console.error('Error getting transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las transacciones'
    });
  }
});

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
    console.error('Error creating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear la transacción'
    });
  }
});

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
    console.error('Error getting transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la transacción'
    });
  }
});

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
    console.error('Error updating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar la transacción'
    });
  }
});

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
    console.error('Error deleting transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar la transacción'
    });
  }
});

// Get financial summary
router.get('/summary', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id);
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }

    // TODO: Calculate from actual transactions when model is created
    const summary = {
      income: {
        total: 0,
        count: 0,
        experience: 0,
        coins: 0
      },
      expense: {
        total: user.totalExpenses,
        count: 0,
        experience: 0,
        coins: 0
      },
      savings: {
        total: user.totalSavings,
        count: 0,
        experience: 0,
        coins: 0
      },
      netWorth: user.totalSavings - user.totalExpenses,
      savingsProgress: user.savingsGoal > 0 
        ? Math.min((user.totalSavings / user.savingsGoal) * 100, 100)
        : 0
    };

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error getting financial summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el resumen financiero'
    });
  }
});

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
    console.error('Error getting monthly summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el resumen mensual'
    });
  }
});

export { router as transactionRoutes }; 