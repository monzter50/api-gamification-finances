import express from 'express';
import type { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { authenticateJWT } from './auth';
import { logger } from '../config/logger';
import { userService } from '../services/user.service';
import { userWalletRepository } from '../repositories/userWallet.repository';
import { userProgressRepository } from '../repositories/userProgress.repository';

const router = express.Router();

// Get gamification profile
router.get('/profile', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    const profile = await userService.getUserProfile(userId);

    const gamificationProfile = {
      level: profile.level,
      experience: profile.experience,
      experienceToNextLevel: profile.experienceToNextLevel,
      levelProgress: profile.levelProgress,
      coins: profile.coins,
      totalSavings: profile.totalSavings,
      totalExpenses: profile.totalExpenses,
      savingsGoal: profile.savingsGoal,
      savingsProgress: profile.savingsProgress,
      achievements: {
        total: profile.achievements.length,
        unlocked: profile.achievements.length,
        completionPercentage: 0 // TODO: Calculate based on total achievements
      },
      badges: {
        total: profile.badges.length,
        unlocked: profile.badges.length
      },
      stats: {
        daysActive: Math.floor((Date.now() - profile.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
        lastLogin: profile.lastLogin,
        isActive: profile.isActive
      }
    };

    res.status(200).json({
      success: true,
      data: gamificationProfile
    });
  } catch (error) {
    logger.error('Error getting gamification profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting gamification profile'
    });
  }
});

// Level up (manual trigger for testing)
router.post('/level-up', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    const profileBefore = await userService.getUserProfile(userId);
    const oldLevel = profileBefore.level;
    const oldExperience = profileBefore.experience;

    // Add experience and check for level up
    const experienceToAdd = 100; // For testing
    const result = await userService.addExperience(userId, experienceToAdd);

    const profileAfter = await userService.getUserProfile(userId);

    res.status(200).json({
      success: true,
      message: result.leveledUp ? `Level up to ${result.newLevel}!` : 'Experience added',
      data: {
        oldLevel,
        newLevel: profileAfter.level,
        oldExperience,
        newExperience: profileAfter.experience,
        experienceGained: result.experienceGained,
        leveledUp: result.leveledUp,
        levelProgress: profileAfter.levelProgress,
        experienceToNextLevel: profileAfter.experienceToNextLevel,
        coins: profileAfter.coins,
        rewardCoins: result.rewardCoins
      }
    });
  } catch (error) {
    logger.error('Error leveling up:', error);
    res.status(500).json({
      success: false,
      message: 'Error leveling up'
    });
  }
});

// Get leaderboard
router.get('/leaderboard', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { limit = 10 } = req.query;
    const userId = req.user?.id;

    // Get leaderboard (sorted by level and experience)
    const leaderboard = await userService.getLeaderboard(parseInt(limit as string));

    // Format leaderboard
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
    let userPosition = null;
    let userStats = null;

    if (userId) {
      const currentProfile = await userService.getUserProfile(userId);
      const userRank = await userProgressRepository.getUserRank(userId);
      userPosition = userRank;
      userStats = {
        name: currentProfile.name,
        level: currentProfile.level,
        experience: currentProfile.experience,
        coins: currentProfile.coins,
        totalSavings: currentProfile.totalSavings,
        totalExpenses: currentProfile.totalExpenses
      };
    }

    res.status(200).json({
      success: true,
      data: {
        leaderboard: formattedLeaderboard,
        type: 'level',
        limit: parseInt(limit as string),
        userPosition,
        userStats
      }
    });
  } catch (error) {
    logger.error('Error getting leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting leaderboard'
    });
  }
});

// Get user progress stats
router.get('/progress', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    const profile = await userService.getUserProfile(userId);

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
        experience: profile.experience,
        coins: profile.coins,
        transactions: 0,
        level: profile.level,
        achievements: profile.achievements.length
      }
    };

    res.status(200).json({
      success: true,
      data: progressStats
    });
  } catch (error) {
    logger.error('Error getting progress stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting progress stats'
    });
  }
});

// Add coins (for testing)
router.post('/add-coins', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { amount } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
      return;
    }

    const walletBefore = await userWalletRepository.findByUserId(userId);
    const oldCoins = walletBefore?.coins || 0;

    await userWalletRepository.addCoins(userId, amount, 'Manual addition for testing');

    const walletAfter = await userWalletRepository.findByUserId(userId);
    const newCoins = walletAfter?.coins || 0;

    res.status(200).json({
      success: true,
      message: `Added ${amount} coins`,
      data: {
        oldCoins,
        newCoins,
        coinsAdded: amount
      }
    });
  } catch (error) {
    logger.error('Error adding coins:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding coins'
    });
  }
});

export { router as gamificationRoutes }; 