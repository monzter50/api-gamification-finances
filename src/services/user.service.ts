import { userRepository } from '../repositories/user.repository';
import { UpdateProfileRequestDto } from '../dto/request/user.dto';
import { UserProfileResponseDto, UserStatsResponseDto, LevelUpResponseDto } from '../dto/response/user.dto';
import { logger } from '../config/logger';

/**
 * User Service
 * Handles business logic for user operations
 */
export class UserService {
  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<UserProfileResponseDto> {
    const user = await userRepository.findByIdWithoutPassword(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Calculate savings progress
    const savingsProgress = user.savingsGoal > 0
      ? Math.min(Math.round((user.totalSavings / user.savingsGoal) * 100), 100)
      : 0;

    return {
      id: (user._id as any).toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      level: user.level,
      experience: user.experience,
      experienceToNextLevel: user.experienceToNextLevel,
      levelProgress: user.levelProgress,
      coins: user.coins,
      totalSavings: user.totalSavings,
      totalExpenses: user.totalExpenses,
      savingsGoal: user.savingsGoal,
      savingsProgress,
      achievements: user.achievements.map(id => id.toString()),
      badges: user.badges.map(id => id.toString()),
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: UpdateProfileRequestDto): Promise<UserProfileResponseDto> {
    const updateData: any = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.savingsGoal !== undefined) {
      updateData.savingsGoal = data.savingsGoal;
    }

    const updatedUser = await userRepository.updateById(userId, updateData);

    if (!updatedUser) {
      throw new Error('User not found');
    }

    logger.info(`User profile updated: ${userId}`);

    return this.getUserProfile(userId);
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string): Promise<UserStatsResponseDto> {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Calculate savings progress
    const savingsProgress = user.savingsGoal > 0
      ? Math.min(Math.round((user.totalSavings / user.savingsGoal) * 100), 100)
      : 0;

    // Calculate account age in days
    const accountAge = Math.floor(
      (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate days since last login
    const lastLoginDaysAgo = Math.floor(
      (Date.now() - user.lastLogin.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      level: user.level,
      experience: user.experience,
      experienceToNextLevel: user.experienceToNextLevel,
      levelProgress: user.levelProgress,
      coins: user.coins,
      totalSavings: user.totalSavings,
      totalExpenses: user.totalExpenses,
      savingsGoal: user.savingsGoal,
      savingsProgress,
      achievementsCount: user.achievements.length,
      badgesCount: user.badges.length,
      accountAge,
      lastLoginDaysAgo
    };
  }

  /**
   * Add experience to user
   */
  async addExperience(userId: string, amount: number): Promise<LevelUpResponseDto> {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Add experience (this will handle level-up logic)
    const result = user.addExperience(amount);

    // Save the user
    await user.save();

    logger.info(`User ${userId} gained ${amount} experience. Level: ${user.level}`);

    // Award coins for leveling up
    let rewardCoins: number | undefined;
    if (result.leveledUp) {
      const coinReward = user.level * 10; // 10 coins per level
      user.addCoins(coinReward);
      await user.save();
      rewardCoins = coinReward;

      logger.info(`User ${userId} leveled up to ${user.level}! Awarded ${coinReward} coins.`);
    }

    if (result.leveledUp) {
      return {
        leveledUp: true,
        newLevel: result.newLevel,
        experienceGained: result.experienceGained,
        currentExperience: user.experience,
        experienceToNextLevel: user.experienceToNextLevel,
        rewardCoins: rewardCoins
      };
    }

    return {
      leveledUp: false,
      newLevel: undefined,
      experienceGained: result.experienceGained,
      currentExperience: user.experience,
      experienceToNextLevel: user.experienceToNextLevel,
      rewardCoins: undefined
    };
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(limit: number = 10): Promise<UserProfileResponseDto[]> {
    const users = await userRepository.getLeaderboard(limit);

    return users.map(user => ({
      id: (user._id as any).toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      level: user.level,
      experience: user.experience,
      experienceToNextLevel: user.experienceToNextLevel,
      levelProgress: user.levelProgress,
      coins: user.coins,
      totalSavings: user.totalSavings,
      totalExpenses: user.totalExpenses,
      savingsGoal: user.savingsGoal,
      achievements: user.achievements.map(id => id.toString()),
      badges: user.badges.map(id => id.toString()),
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));
  }

  /**
   * Spend user coins
   */
  async spendCoins(userId: string, amount: number, description?: string): Promise<{ remainingCoins: number }> {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.canAfford(amount)) {
      throw new Error('Insufficient coins');
    }

    user.spendCoins(amount);
    await user.save();

    logger.info(`User ${userId} spent ${amount} coins${description ? ` on: ${description}` : ''}`);

    return {
      remainingCoins: user.coins
    };
  }
}

// Export singleton instance
export const userService = new UserService();
