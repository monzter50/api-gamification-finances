import { achievementRepository } from '../repositories/achievement.repository';
import { userRepository } from '../repositories/user.repository';
import {
  AchievementResponseDto,
  UserAchievementResponseDto,
  UserAchievementsListDto,
  UnlockAchievementResponseDto,
  AchievementProgressDto
} from '../dto/response/achievement.dto';
import { logger } from '../config/logger';

/**
 * Achievement Service
 * Handles business logic for achievement operations
 */
export class AchievementService {
  /**
   * Get all active achievements
   */
  async getAllAchievements(): Promise<AchievementResponseDto[]> {
    const achievements = await achievementRepository.findActiveAchievements();

    return achievements.map(achievement => ({
      id: (achievement._id as any).toString(),
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      category: achievement.category,
      criteria: achievement.criteria,
      reward: achievement.reward,
      rarity: achievement.rarity,
      rarityColor: achievement.rarityColor,
      isActive: achievement.isActive
    }));
  }

  /**
   * Get user's achievements with unlock status
   */
  async getUserAchievements(userId: string): Promise<UserAchievementsListDto> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    await user.populate('achievements');

    const allAchievements = await achievementRepository.findActiveAchievements();
    const userAchievementIds = user.achievements?.map(a => a.toString()) || [];

    const achievementsWithStatus: UserAchievementResponseDto[] = allAchievements.map(achievement => {
      const isUnlocked = userAchievementIds.includes((achievement._id as any)?.toString() || '');

      return {
        id: (achievement._id as any).toString(),
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        category: achievement.category,
        criteria: achievement.criteria,
        reward: achievement.reward,
        rarity: achievement.rarity,
        rarityColor: achievement.rarityColor,
        isActive: achievement.isActive,
        isUnlocked,
        unlockDate: null, // TODO: Add unlockDate tracking
        progress: 0 // TODO: Calculate progress based on criteria
      };
    });

    return {
      achievements: achievementsWithStatus,
      totalAchievements: allAchievements.length,
      unlockedAchievements: userAchievementIds.length,
      completionPercentage: allAchievements.length > 0
        ? Math.round((userAchievementIds.length / allAchievements.length) * 100)
        : 0
    };
  }

  /**
   * Unlock an achievement for a user
   */
  async unlockAchievement(userId: string, achievementId: string): Promise<UnlockAchievementResponseDto> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const achievement = await achievementRepository.findById(achievementId);
    if (!achievement) {
      throw new Error('Achievement not found');
    }

    if (!achievement.isActive) {
      throw new Error('This achievement is not available');
    }

    // Check if user already has this achievement
    const userAchievementIds = user.achievements?.map(a => a.toString()) || [];
    if (userAchievementIds.includes((achievement._id as any)?.toString() || '')) {
      throw new Error('Achievement already unlocked');
    }

    // TODO: Check if user meets criteria before unlocking
    // For now, we'll allow manual unlocking for testing

    // Add achievement to user
    user.achievements = user.achievements || [];
    user.achievements.push(achievement._id as any);

    // Add rewards
    const experienceResult = user.addExperience(achievement.reward.experience);
    user.addCoins(achievement.reward.coins);

    await user.save();

    logger.info(`Achievement unlocked: ${achievement.name} by user ${userId}`);

    return {
      achievement: {
        id: (achievement._id as any).toString(),
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
    };
  }

  /**
   * Get achievement progress for a user
   */
  async getAchievementProgress(userId: string, achievementId: string): Promise<AchievementProgressDto> {
    const achievement = await achievementRepository.findById(achievementId);
    if (!achievement) {
      throw new Error('Achievement not found');
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // TODO: Calculate actual progress based on criteria
    // For now, returning placeholder values
    const progress = {
      current: 0,
      target: achievement.criteria.value,
      percentage: 0,
      isCompleted: false
    };

    return {
      achievement: {
        id: (achievement._id as any).toString(),
        name: achievement.name,
        description: achievement.description,
        criteria: achievement.criteria
      },
      progress
    };
  }

  /**
   * Check and auto-unlock achievements for a user based on their stats
   */
  async checkAndUnlockAchievements(userId: string): Promise<UnlockAchievementResponseDto[]> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const userStats = {
      transactionCount: 0, // TODO: Get from transaction count
      totalAmount: user.totalSavings + user.totalExpenses,
      totalSavings: user.totalSavings,
      streakDays: 0, // TODO: Calculate streak
      level: user.level
    };

    const allAchievements = await achievementRepository.findActiveAchievements();
    const userAchievementIds = user.achievements?.map(a => a.toString()) || [];
    const unlockedAchievements: UnlockAchievementResponseDto[] = [];

    for (const achievement of allAchievements) {
      const achievementId = (achievement._id as any).toString();

      // Skip if already unlocked
      if (userAchievementIds.includes(achievementId)) {
        continue;
      }

      // Check if criteria is met
      const criteriaMet = await achievementRepository.checkCriteria(achievementId, userStats);

      if (criteriaMet) {
        const result = await this.unlockAchievement(userId, achievementId);
        unlockedAchievements.push(result);
      }
    }

    return unlockedAchievements;
  }
}

// Export singleton instance
export const achievementService = new AchievementService();
