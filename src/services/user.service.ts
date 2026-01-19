import { userRepository } from '../repositories/user.repository';
// import { userWalletRepository } from '../repositories/userWallet.repository';
// import { userProgressRepository } from '../repositories/userProgress.repository';
// import { userProfileRepository } from '../repositories/userProfile.repository';
import { type UpdateProfileRequestDto } from '../dto/request/user.dto';
import { type UserProfileResponseDto, type UserStatsResponseDto, type LevelUpResponseDto } from '../dto/response/user.dto';
import { logger } from '../config/logger';

/**
 * User Service
 * Handles business logic for user operations
 */
export class UserService {
  /**
   * Get user profile by ID
   */
  async getUserProfile (userId: string): Promise<UserProfileResponseDto> {
    const user = await userRepository.findByIdWithoutPassword(userId);

    if (!user) {
      throw new Error('User not found');
    }

    /*
    // Fetch associated data from separate models
    const [wallet, progress, profile] = await Promise.all([
      userWalletRepository.findByUserId(userId),
      userProgressRepository.findByUserId(userId),
      userProfileRepository.findByUserId(userId)
    ]);
    */

    // Calculate savings progress
    /*
    const savingsProgress = profile && profile.savingsGoal > 0
      ? Math.min(Math.round((profile.totalSavings / profile.savingsGoal) * 100), 100)
      : 0;
    */

    return {
      id: (user as any).id,
      email: user.email,
      name: user.name,
      role: user.role,
      level: 1, // progress?.level || 1,
      experience: 0, // progress?.experience || 0,
      experienceToNextLevel: 100, // progress?.experienceToNextLevel || 100,
      levelProgress: 0, // progress?.levelProgress || 0,
      coins: 0, // wallet?.coins || 0,
      totalSavings: 0, // profile?.totalSavings || 0,
      totalExpenses: 0, // profile?.totalExpenses || 0,
      savingsGoal: 0, // profile?.savingsGoal || 0,
      savingsProgress: 0, // savingsProgress,
      achievements: [], // progress?.achievements?.map((id: any) => id.toString()) || [],
      badges: [], // progress?.badges?.map((id: any) => id.toString()) || [],
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  /**
   * Update user profile
   */
  async updateProfile (userId: string, data: UpdateProfileRequestDto): Promise<UserProfileResponseDto> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Update user name if provided
    if (data.name !== undefined) {
      await userRepository.updateById(userId, { name: data.name });
    }

    // Update savings goal if provided
    /*
    if (data.savingsGoal !== undefined) {
      await userProfileRepository.setSavingsGoal(userId, data.savingsGoal);
    }
    */

    logger.info(`User profile updated: ${userId}`);

    return await this.getUserProfile(userId);
  }

  /**
   * Get user statistics
   */
  async getUserStats (userId: string): Promise<UserStatsResponseDto> {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    /*
    // Fetch associated data from separate models
    const [wallet, progress, profile] = await Promise.all([
      userWalletRepository.findByUserId(userId),
      userProgressRepository.findByUserId(userId),
      userProfileRepository.findByUserId(userId)
    ]);
    */

    // Calculate savings progress
    /*
    const savingsProgress = profile && profile.savingsGoal > 0
      ? Math.min(Math.round((profile.totalSavings / profile.savingsGoal) * 100), 100)
      : 0;
    */

    // Calculate account age in days
    const accountAge = Math.floor(
      (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate days since last login
    const lastLoginDaysAgo = Math.floor(
      (Date.now() - user.lastLogin.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      level: 1,
      experience: 0,
      experienceToNextLevel: 100,
      levelProgress: 0,
      coins: 0,
      totalSavings: 0,
      totalExpenses: 0,
      savingsGoal: 0,
      savingsProgress: 0,
      achievementsCount: 0,
      badgesCount: 0,
      accountAge,
      lastLoginDaysAgo
    };
  }

  /**
   * Add experience to user
   */
  async addExperience (userId: string, amount: number): Promise<LevelUpResponseDto> {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Disabled as repos missing
    /*
    // Add experience (this will handle level-up logic)
    const { progress, result } = await userProgressRepository.addExperience(userId, amount);

    logger.info(`User ${userId} gained ${amount} experience. Level: ${progress.level}`);

    // Award coins for leveling up
    let rewardCoins: number | undefined;
    if (result.leveledUp && result.newLevel) {
      const coinReward = result.newLevel * 10; // 10 coins per level
      await userWalletRepository.addCoins(userId, coinReward, `Level ${result.newLevel} reward`);
      rewardCoins = coinReward;

      logger.info(`User ${userId} leveled up to ${result.newLevel}! Awarded ${coinReward} coins.`);
    }

    if (result.leveledUp) {
      return {
        leveledUp: true,
        newLevel: result.newLevel,
        experienceGained: result.experienceGained,
        currentExperience: progress.experience,
        experienceToNextLevel: progress.experienceToNextLevel,
        rewardCoins: rewardCoins
      };
    }
    */

    // Mock response
    return {
      leveledUp: false,
      newLevel: undefined,
      experienceGained: amount, // Mock
      currentExperience: 0,
      experienceToNextLevel: 100,
      rewardCoins: undefined
    };
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard (limit: number = 10): Promise<UserProfileResponseDto[]> {
    // Disabled functionality
    return [];
  }

  /**
   * Spend user coins
   */
  async spendCoins (userId: string, amount: number, description?: string): Promise<{ remainingCoins: number }> {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Disabled functionality
    throw new Error('Feature disabled');

    /*
    // Check if user can afford the amount
    const canAfford = await userWalletRepository.canAfford(userId, amount);
    if (!canAfford) {
      throw new Error('Insufficient coins');
    }

    // Spend the coins
    const wallet = await userWalletRepository.spendCoins(userId, amount, description);

    logger.info(`User ${userId} spent ${amount} coins${description ? ` on: ${description}` : ''}`);

    return {
      remainingCoins: wallet.coins
    };
    */
  }
}

// Export singleton instance
export const userService = new UserService();
