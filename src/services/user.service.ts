import { userRepository } from '../repositories/user.repository';
import { userWalletRepository } from '../repositories/userWallet.repository';
import { userProgressRepository } from '../repositories/userProgress.repository';
import { userProfileRepository } from '../repositories/userProfile.repository';
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

    // Fetch associated data from separate models
    const [wallet, progress, profile] = await Promise.all([
      userWalletRepository.findByUserId(userId),
      userProgressRepository.findByUserId(userId),
      userProfileRepository.findByUserId(userId)
    ]);

    // Calculate savings progress
    const savingsProgress = profile && profile.savingsGoal > 0
      ? Math.min(Math.round((profile.totalSavings / profile.savingsGoal) * 100), 100)
      : 0;

    return {
      id: (user._id as any).toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      level: progress?.level || 1,
      experience: progress?.experience || 0,
      experienceToNextLevel: progress?.experienceToNextLevel || 100,
      levelProgress: progress?.levelProgress || 0,
      coins: wallet?.coins || 0,
      totalSavings: profile?.totalSavings || 0,
      totalExpenses: profile?.totalExpenses || 0,
      savingsGoal: profile?.savingsGoal || 0,
      savingsProgress,
      achievements: progress?.achievements?.map((id: any) => id.toString()) || [],
      badges: progress?.badges?.map((id: any) => id.toString()) || [],
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
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Update user name if provided
    if (data.name !== undefined) {
      await userRepository.updateById(userId, { name: data.name });
    }

    // Update savings goal if provided
    if (data.savingsGoal !== undefined) {
      await userProfileRepository.setSavingsGoal(userId, data.savingsGoal);
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

    // Fetch associated data from separate models
    const [wallet, progress, profile] = await Promise.all([
      userWalletRepository.findByUserId(userId),
      userProgressRepository.findByUserId(userId),
      userProfileRepository.findByUserId(userId)
    ]);

    // Calculate savings progress
    const savingsProgress = profile && profile.savingsGoal > 0
      ? Math.min(Math.round((profile.totalSavings / profile.savingsGoal) * 100), 100)
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
      level: progress?.level || 1,
      experience: progress?.experience || 0,
      experienceToNextLevel: progress?.experienceToNextLevel || 100,
      levelProgress: progress?.levelProgress || 0,
      coins: wallet?.coins || 0,
      totalSavings: profile?.totalSavings || 0,
      totalExpenses: profile?.totalExpenses || 0,
      savingsGoal: profile?.savingsGoal || 0,
      savingsProgress,
      achievementsCount: progress?.achievements?.length || 0,
      badgesCount: progress?.badges?.length || 0,
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

    return {
      leveledUp: false,
      newLevel: undefined,
      experienceGained: result.experienceGained,
      currentExperience: progress.experience,
      experienceToNextLevel: progress.experienceToNextLevel,
      rewardCoins: undefined
    };
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(limit: number = 10): Promise<UserProfileResponseDto[]> {
    // Get top users by progress (level and experience)
    const topProgress = await userProgressRepository.getLeaderboard(limit);

    // Build response with data from all models
    const leaderboard = await Promise.all(
      topProgress.map(async (progress) => {
        const userId = (progress.userId as any).toString();
        const user = await userRepository.findByIdWithoutPassword(userId);

        if (!user) {
          return null;
        }

        const [wallet, profile] = await Promise.all([
          userWalletRepository.findByUserId(userId),
          userProfileRepository.findByUserId(userId)
        ]);

        const savingsProgress = profile && profile.savingsGoal > 0
          ? Math.min(Math.round((profile.totalSavings / profile.savingsGoal) * 100), 100)
          : 0;

        return {
          id: userId,
          email: user.email,
          name: user.name,
          role: user.role,
          level: progress.level,
          experience: progress.experience,
          experienceToNextLevel: progress.experienceToNextLevel,
          levelProgress: progress.levelProgress,
          coins: wallet?.coins || 0,
          totalSavings: profile?.totalSavings || 0,
          totalExpenses: profile?.totalExpenses || 0,
          savingsGoal: profile?.savingsGoal || 0,
          savingsProgress,
          achievements: progress.achievements?.map((id: any) => id.toString()) || [],
          badges: progress.badges?.map((id: any) => id.toString()) || [],
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        };
      })
    );

    // Filter out null values
    return leaderboard.filter(entry => entry !== null) as UserProfileResponseDto[];
  }

  /**
   * Spend user coins
   */
  async spendCoins(userId: string, amount: number, description?: string): Promise<{ remainingCoins: number }> {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

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
  }
}

// Export singleton instance
export const userService = new UserService();
