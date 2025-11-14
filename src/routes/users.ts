import express from 'express';
import type { Response } from 'express';
import { User } from '../models/User';
import { AuthenticatedRequest } from '../types';
import { authenticateJWT } from './auth';
import { logger } from '../config/logger';

const router = express.Router();

// Get user profile
router.get('/profile', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id).select('-password');
    
    if (!user) {
      res.status(404).json({ 
        success: false, 
        message: 'Usuario no encontrado' 
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        name: user.name,
        level: user.level,
        experience: user.experience,
        coins: user.coins,
        totalSavings: user.totalSavings,
        totalExpenses: user.totalExpenses,
        savingsGoal: user.savingsGoal,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    logger.error('Error getting user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el perfil del usuario'
    });
  }
});

// Update user profile
router.put('/profile', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, savingsGoal } = req.body;
    const updateData: any = {};

    // Only allow updating specific fields
    if (name !== undefined) {
      updateData.name = name;
    }
    if (savingsGoal !== undefined) {
      updateData.savingsGoal = savingsGoal;
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({
        success: false,
        message: 'No se proporcionaron datos para actualizar'
      });
      return;
    }

    const user = await User.findByIdAndUpdate(
      req.user?.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Perfil actualizado correctamente',
      data: {
        id: user._id,
        email: user.email,
        name: user.name,
        level: user.level,
        experience: user.experience,
        coins: user.coins,
        totalSavings: user.totalSavings,
        totalExpenses: user.totalExpenses,
        savingsGoal: user.savingsGoal,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    logger.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el perfil del usuario'
    });
  }
});

// Get user stats
router.get('/stats', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id);
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }

    // Calculate additional stats
    const savingsProgress = user.savingsGoal > 0 
      ? Math.min((user.totalSavings / user.savingsGoal) * 100, 100)
      : 0;

    const experienceToNextLevel = user.experienceToNextLevel || 0;
    const levelProgress = user.levelProgress || 0;

    res.status(200).json({
      success: true,
      data: {
        // Basic stats
        totalTransactions: 0, // TODO: Implement when transactions are added
        currentStreak: 0, // TODO: Implement streak tracking
        
        // Financial stats
        totalSavings: user.totalSavings,
        totalExpenses: user.totalExpenses,
        savingsGoal: user.savingsGoal,
        savingsProgress: Math.round(savingsProgress * 100) / 100,
        savingsGoalReached: user.totalSavings >= user.savingsGoal,
        
        // Gamification stats
        level: user.level,
        experience: user.experience,
        experienceToNextLevel,
        levelProgress: Math.round(levelProgress * 100) / 100,
        coins: user.coins,
        
        // Achievement stats
        totalAchievements: user.achievements?.length || 0,
        totalBadges: user.badges?.length || 0,
        
        // Activity stats
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        daysSinceRegistration: Math.floor(
          (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        )
      }
    });
  } catch (error) {
    logger.error('Error getting user stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las estadísticas del usuario'
    });
  }
});

export { router as userRoutes }; 