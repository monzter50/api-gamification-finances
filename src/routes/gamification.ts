import express from 'express';
import type { Response } from 'express';
import { User } from '../models/User';
import { AuthenticatedRequest } from '../types';
import { authenticateJWT } from './auth';

const router = express.Router();

// Get gamification profile
router.get('/profile', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id);
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }

    const gamificationProfile = {
      level: user.level,
      experience: user.experience,
      experienceToNextLevel: user.experienceToNextLevel || 0,
      levelProgress: user.levelProgress || 0,
      coins: user.coins,
      totalSavings: user.totalSavings,
      totalExpenses: user.totalExpenses,
      savingsGoal: user.savingsGoal,
      savingsProgress: user.savingsGoal > 0 
        ? Math.min((user.totalSavings / user.savingsGoal) * 100, 100)
        : 0,
      achievements: {
        total: user.achievements?.length || 0,
        unlocked: user.achievements?.length || 0,
        completionPercentage: 0 // TODO: Calculate based on total achievements
      },
      badges: {
        total: user.badges?.length || 0,
        unlocked: user.badges?.length || 0
      },
      stats: {
        daysActive: Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
        lastLogin: user.lastLogin,
        isActive: user.isActive
      }
    };

    res.status(200).json({
      success: true,
      data: gamificationProfile
    });
  } catch (error) {
    console.error('Error getting gamification profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el perfil de gamificación'
    });
  }
});

// Level up (manual trigger for testing)
router.post('/level-up', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id);
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }

    const oldLevel = user.level;
    const oldExperience = user.experience;
    
    // Add experience and check for level up
    const experienceToAdd = 100; // For testing
    const result = user.addExperience(experienceToAdd);
    
    await user.save();

    res.status(200).json({
      success: true,
      message: result.leveledUp ? `¡Subiste al nivel ${result.newLevel}!` : 'Experiencia añadida',
      data: {
        oldLevel,
        newLevel: user.level,
        oldExperience: oldExperience,
        newExperience: user.experience,
        experienceGained: result.experienceGained,
        leveledUp: result.leveledUp,
        levelProgress: user.levelProgress,
        experienceToNextLevel: user.experienceToNextLevel,
        coins: user.coins
      }
    });
  } catch (error) {
    console.error('Error leveling up:', error);
    res.status(500).json({
      success: false,
      message: 'Error al subir de nivel'
    });
  }
});

// Get leaderboard
router.get('/leaderboard', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { type = 'level', limit = 10 } = req.query;
    
    let sortCriteria: any = {};
    let projection: any = {
      name: 1,
      level: 1,
      experience: 1,
      coins: 1,
      totalSavings: 1,
      totalExpenses: 1
    };

    switch (type) {
      case 'level':
        sortCriteria = { level: -1, experience: -1 };
        break;
      case 'coins':
        sortCriteria = { coins: -1 };
        break;
      case 'savings':
        sortCriteria = { totalSavings: -1 };
        break;
      case 'experience':
        sortCriteria = { experience: -1 };
        break;
      default:
        sortCriteria = { level: -1, experience: -1 };
    }

    const leaderboard = await User.find({ isActive: true })
      .select(projection)
      .sort(sortCriteria)
      .limit(parseInt(limit as string))
      .lean();

    // Add position and format data
    const formattedLeaderboard = leaderboard.map((user, index) => ({
      position: index + 1,
      name: user.name,
      level: user.level,
      experience: user.experience,
      coins: user.coins,
      totalSavings: user.totalSavings,
      totalExpenses: user.totalExpenses
    }));

    // Get current user's position
    const currentUser = await User.findById(req.user?.id).select(projection);
    let userPosition = null;
    
    if (currentUser) {
      const userCount = await User.countDocuments({
        isActive: true,
        [type === 'level' ? 'level' : type === 'coins' ? 'coins' : type === 'savings' ? 'totalSavings' : 'experience']: {
          $gt: type === 'level' ? currentUser.level : 
               type === 'coins' ? currentUser.coins :
               type === 'savings' ? currentUser.totalSavings :
               currentUser.experience
        }
      });
      userPosition = userCount + 1;
    }

    res.status(200).json({
      success: true,
      data: {
        leaderboard: formattedLeaderboard,
        type,
        limit: parseInt(limit as string),
        userPosition,
        userStats: currentUser ? {
          name: currentUser.name,
          level: currentUser.level,
          experience: currentUser.experience,
          coins: currentUser.coins,
          totalSavings: currentUser.totalSavings,
          totalExpenses: currentUser.totalExpenses
        } : null
      }
    });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la tabla de clasificación'
    });
  }
});

// Get user progress stats
router.get('/progress', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id);
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }

    // TODO: Calculate actual progress from transactions
    const progressStats = {
      weekly: {
        experience: 0,
        coins: 0,
        transactions: 0
      },
      monthly: {
        experience: 0,
        coins: 0,
        transactions: 0
      },
      allTime: {
        experience: user.experience,
        coins: user.coins,
        transactions: 0,
        level: user.level,
        achievements: user.achievements?.length || 0
      }
    };

    res.status(200).json({
      success: true,
      data: progressStats
    });
  } catch (error) {
    console.error('Error getting progress stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las estadísticas de progreso'
    });
  }
});

// Add coins (for testing)
router.post('/add-coins', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { amount } = req.body;
    const user = await User.findById(req.user?.id);
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({
        success: false,
        message: 'Cantidad inválida'
      });
      return;
    }

    const oldCoins = user.coins;
    const newCoins = user.addCoins(amount);
    
    await user.save();

    res.status(200).json({
      success: true,
      message: `Se añadieron ${amount} monedas`,
      data: {
        oldCoins,
        newCoins,
        coinsAdded: amount
      }
    });
  } catch (error) {
    console.error('Error adding coins:', error);
    res.status(500).json({
      success: false,
      message: 'Error al añadir monedas'
    });
  }
});

export { router as gamificationRoutes }; 