import express from 'express';
import type { Response } from 'express';
import { userService } from '../services/user.service';
import { updateProfileValidation } from '../validators/user.validator';
import { validate } from '../middleware/validate';
import { AuthenticatedRequest } from '../types';
import { authenticateJWT } from './auth';

const router = express.Router();

// Get user profile
router.get('/profile', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const profile = await userService.getUserProfile(userId);

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al obtener el perfil del usuario';
    const statusCode = message.includes('not found') ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      message
    });
  }
});

// Update user profile
router.put('/profile', authenticateJWT, updateProfileValidation, validate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { name, savingsGoal } = req.body;

    const profile = await userService.updateProfile(userId, { name, savingsGoal });

    res.status(200).json({
      success: true,
      message: 'Perfil actualizado correctamente',
      data: profile
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al actualizar el perfil del usuario';
    const statusCode = message.includes('not found') ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      message
    });
  }
});

// Get user stats
router.get('/stats', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const stats = await userService.getUserStats(userId);

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al obtener las estadísticas del usuario';
    const statusCode = message.includes('not found') ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      message
    });
  }
});

export { router as userRoutes }; 