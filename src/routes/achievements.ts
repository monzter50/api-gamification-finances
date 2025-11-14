import express from 'express';
import type { Response } from 'express';
import { User } from '../models/User';
import { Achievement } from '../models/Achievement';
import { AuthenticatedRequest } from '../types';
import { authenticateJWT } from './auth';

const router = express.Router();

// Get all achievements
router.get('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const achievements = await Achievement.find({ isActive: true }).sort({ rarity: 1, name: 1 });
    
    res.status(200).json({
      success: true,
      data: achievements.map(achievement => ({
        id: achievement._id,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        category: achievement.category,
        criteria: achievement.criteria,
        reward: achievement.reward,
        rarity: achievement.rarity,
        rarityColor: achievement.rarityColor,
        isActive: achievement.isActive
      }))
    });
  } catch (error) {
    console.error('Error getting achievements:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los logros'
    });
  }
});

// Get user achievements
router.get('/user', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id).populate('achievements');
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }

    // Get all achievements to compare with user's achievements
    const allAchievements = await Achievement.find({ isActive: true });
    const userAchievementIds = user.achievements?.map(a => a.toString()) || [];
    
    const achievementsWithStatus = allAchievements.map(achievement => {
      const isUnlocked = userAchievementIds.includes(achievement._id?.toString() || '');
      
      return {
        id: achievement._id,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        category: achievement.category,
        criteria: achievement.criteria,
        reward: achievement.reward,
        rarity: achievement.rarity,
        rarityColor: achievement.rarityColor,
        isUnlocked,
        unlockDate: null, // TODO: Add unlockDate tracking
        progress: 0 // TODO: Calculate progress based on criteria
      };
    });

    res.status(200).json({
      success: true,
      data: {
        achievements: achievementsWithStatus,
        totalAchievements: allAchievements.length,
        unlockedAchievements: userAchievementIds.length,
        completionPercentage: Math.round((userAchievementIds.length / allAchievements.length) * 100)
      }
    });
  } catch (error) {
    console.error('Error getting user achievements:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los logros del usuario'
    });
  }
});

// Unlock achievement
router.post('/:id/unlock', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findById(req.user?.id);
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }

    const achievement = await Achievement.findById(id);
    if (!achievement) {
      res.status(404).json({
        success: false,
        message: 'Logro no encontrado'
      });
      return;
    }

    if (!achievement.isActive) {
      res.status(400).json({
        success: false,
        message: 'Este logro no está disponible'
      });
      return;
    }

    // Check if user already has this achievement
    const userAchievementIds = user.achievements?.map(a => a.toString()) || [];
    if (userAchievementIds.includes(achievement._id?.toString() || '')) {
      res.status(400).json({
        success: false,
        message: 'Ya tienes este logro desbloqueado'
      });
      return;
    }

    // TODO: Check if user meets criteria before unlocking
    // For now, we'll allow manual unlocking for testing

    // Add achievement to user
    user.achievements = user.achievements || [];
    user.achievements.push(achievement._id as any);
    
    // Add rewards
    user.experience += achievement.reward.experience;
    user.coins += achievement.reward.coins;
    
    await user.save();

    res.status(200).json({
      success: true,
      message: `¡Logro desbloqueado: ${achievement.name}!`,
      data: {
        achievement: {
          id: achievement._id,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          rarity: achievement.rarity,
          rarityColor: achievement.rarityColor
        },
        rewards: {
          experience: achievement.reward.experience,
          coins: achievement.reward.coins
        },
        userStats: {
          level: user.level,
          experience: user.experience,
          coins: user.coins,
          totalAchievements: user.achievements.length
        }
      }
    });
  } catch (error) {
    console.error('Error unlocking achievement:', error);
    res.status(500).json({
      success: false,
      message: 'Error al desbloquear el logro'
    });
  }
});

// Get achievement progress
router.get('/:id/progress', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const achievement = await Achievement.findById(id);
    
    if (!achievement) {
      res.status(404).json({
        success: false,
        message: 'Logro no encontrado'
      });
      return;
    }

    const user = await User.findById(req.user?.id);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }

    // TODO: Calculate actual progress based on criteria
    const progress = {
      current: 0,
      target: achievement.criteria.value,
      percentage: 0,
      isCompleted: false
    };

    res.status(200).json({
      success: true,
      data: {
        achievement: {
          id: achievement._id,
          name: achievement.name,
          description: achievement.description,
          criteria: achievement.criteria
        },
        progress
      }
    });
  } catch (error) {
    console.error('Error getting achievement progress:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el progreso del logro'
    });
  }
});

export { router as achievementRoutes }; 