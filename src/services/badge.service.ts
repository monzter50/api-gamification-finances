import { badgeRepository } from '../repositories/badge.repository';
import { userProgressRepository } from '../repositories/userProgress.repository';
import { userWalletRepository } from '../repositories/userWallet.repository';
import { userProfileRepository } from '../repositories/userProfile.repository';
import { IBadge } from '../models/Badge';
import { logger } from '../config/logger';

/**
 * Badge Service
 * Handles business logic for badge operations
 */
export class BadgeService {
  /**
   * Get all active badges
   */
  async getAllActiveBadges(): Promise<IBadge[]> {
    return badgeRepository.findActive();
  }

  /**
   * Get all available badges (considering time limits)
   */
  async getAllAvailableBadges(): Promise<IBadge[]> {
    return badgeRepository.findAvailable();
  }

  /**
   * Get badge by ID
   */
  async getBadgeById(badgeId: string): Promise<IBadge> {
    const badge = await badgeRepository.findById(badgeId);
    if (!badge) {
      throw new Error('Badge not found');
    }
    return badge;
  }

  /**
   * Get badges by category
   */
  async getBadgesByCategory(category: string): Promise<IBadge[]> {
    return badgeRepository.findByCategory(category);
  }

  /**
   * Get badges by rarity
   */
  async getBadgesByRarity(rarity: string): Promise<IBadge[]> {
    return badgeRepository.findByRarity(rarity);
  }

  /**
   * Create a new badge (admin only)
   */
  async createBadge(badgeData: {
    name: string;
    description: string;
    icon?: string;
    category: 'achievement' | 'milestone' | 'special' | 'seasonal' | 'event';
    rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'unique';
    criteria: {
      type: 'achievement_count' | 'level_reached' | 'coins_earned' | 'savings_milestone' | 'streak_days' | 'special_event';
      value: number;
      description: string;
    };
    isLimited?: boolean;
    availableFrom?: Date;
    availableUntil?: Date;
  }): Promise<IBadge> {
    // Check if badge with same name exists
    const existingBadge = await badgeRepository.findByName(badgeData.name);
    if (existingBadge) {
      throw new Error('Badge with this name already exists');
    }

    const badge = await badgeRepository.create(badgeData as any);
    logger.info(`New badge created: ${badge.name} (${badge.rarity})`);
    return badge;
  }

  /**
   * Update a badge (admin only)
   */
  async updateBadge(badgeId: string, updateData: Partial<IBadge>): Promise<IBadge> {
    const badge = await badgeRepository.findById(badgeId);
    if (!badge) {
      throw new Error('Badge not found');
    }

    const updatedBadge = await badgeRepository.updateById(badgeId, updateData);
    if (!updatedBadge) {
      throw new Error('Failed to update badge');
    }

    logger.info(`Badge updated: ${updatedBadge.name}`);
    return updatedBadge;
  }

  /**
   * Deactivate a badge (admin only)
   */
  async deactivateBadge(badgeId: string): Promise<IBadge> {
    const badge = await badgeRepository.deactivate(badgeId);
    logger.info(`Badge deactivated: ${badge.name}`);
    return badge;
  }

  /**
   * Activate a badge (admin only)
   */
  async activateBadge(badgeId: string): Promise<IBadge> {
    const badge = await badgeRepository.activate(badgeId);
    logger.info(`Badge activated: ${badge.name}`);
    return badge;
  }

  /**
   * Delete a badge (admin only)
   */
  async deleteBadge(badgeId: string): Promise<void> {
    const badge = await badgeRepository.findById(badgeId);
    if (!badge) {
      throw new Error('Badge not found');
    }

    await badgeRepository.deleteById(badgeId);
    logger.info(`Badge deleted: ${badge.name}`);
  }

  /**
   * Check if user has a badge
   */
  async userHasBadge(userId: string, badgeId: string): Promise<boolean> {
    const progress = await userProgressRepository.findByUserId(userId);
    if (!progress) {
      return false;
    }

    return progress.badges.some((badge: any) => badge.toString() === badgeId);
  }

  /**
   * Get user's badges
   */
  async getUserBadges(userId: string): Promise<IBadge[]> {
    const progress = await userProgressRepository.findByUserId(userId);
    if (!progress || !progress.badges || progress.badges.length === 0) {
      return [];
    }

    const badgeIds = progress.badges.map((badge: any) => badge.toString());
    const badges = await Promise.all(
      badgeIds.map((id: string) => badgeRepository.findById(id))
    );

    return badges.filter(badge => badge !== null) as IBadge[];
  }

  /**
   * Award badge to user
   */
  async awardBadgeToUser(userId: string, badgeId: string): Promise<{
    badge: IBadge;
    coinsAwarded: number;
    experienceAwarded: number;
  }> {
    // Check if badge exists and is available
    const badge = await badgeRepository.findById(badgeId);
    if (!badge) {
      throw new Error('Badge not found');
    }

    if (!badge.isActive) {
      throw new Error('Badge is not active');
    }

    // Check if user already has the badge
    const hasBadge = await this.userHasBadge(userId, badgeId);
    if (hasBadge) {
      throw new Error('User already has this badge');
    }

    // Award the badge
    await userProgressRepository.addBadge(userId, badgeId);

    // Calculate rewards based on rarity
    let coinsAwarded = 0;
    let experienceAwarded = 0;

    switch (badge.rarity) {
      case 'common':
        coinsAwarded = 10;
        experienceAwarded = 20;
        break;
      case 'rare':
        coinsAwarded = 25;
        experienceAwarded = 50;
        break;
      case 'epic':
        coinsAwarded = 50;
        experienceAwarded = 100;
        break;
      case 'legendary':
        coinsAwarded = 100;
        experienceAwarded = 200;
        break;
      case 'unique':
        coinsAwarded = 250;
        experienceAwarded = 500;
        break;
    }

    // Award coins and experience
    await userWalletRepository.addCoins(userId, coinsAwarded, `Badge reward: ${badge.name}`);
    await userProgressRepository.addExperience(userId, experienceAwarded);

    logger.info(`User ${userId} earned badge: ${badge.name} (+${coinsAwarded} coins, +${experienceAwarded} XP)`);

    return {
      badge,
      coinsAwarded,
      experienceAwarded
    };
  }

  /**
   * Check and award unlockable badges to user
   */
  async checkAndAwardBadges(userId: string): Promise<{
    badgesAwarded: IBadge[];
    totalCoins: number;
    totalExperience: number;
  }> {
    // Get user stats
    const [progress, wallet, profile] = await Promise.all([
      userProgressRepository.findByUserId(userId),
      userWalletRepository.findByUserId(userId),
      userProfileRepository.findByUserId(userId)
    ]);

    if (!progress) {
      throw new Error('User progress not found');
    }

    const userStats = {
      achievementCount: progress.achievements?.length || 0,
      level: progress.level || 1,
      coinsEarned: wallet?.coins || 0,
      totalSavings: profile?.totalSavings || 0,
      streakDays: 0 // TODO: Implement streak tracking
    };

    // Get unlockable badges
    const unlockableBadges = await badgeRepository.findUnlockableBadges(userStats);

    // Filter out badges user already has
    const userBadgeIds = progress.badges?.map((b: any) => b.toString()) || [];
    const newBadges = unlockableBadges.filter(
      badge => !userBadgeIds.includes((badge._id as any).toString())
    );

    const badgesAwarded: IBadge[] = [];
    let totalCoins = 0;
    let totalExperience = 0;

    // Award each new badge
    for (const badge of newBadges) {
      try {
        const result = await this.awardBadgeToUser(userId, (badge._id as any).toString());
        badgesAwarded.push(result.badge);
        totalCoins += result.coinsAwarded;
        totalExperience += result.experienceAwarded;
      } catch (error) {
        logger.error(`Failed to award badge ${badge.name} to user ${userId}:`, error);
      }
    }

    return {
      badgesAwarded,
      totalCoins,
      totalExperience
    };
  }

  /**
   * Get badge statistics
   */
  async getBadgeStats(): Promise<{
    totalBadges: number;
    activeBadges: number;
    byCategory: Record<string, number>;
    byRarity: Record<string, number>;
  }> {
    const allBadges = await badgeRepository.find();
    const activeBadges = allBadges.filter((b: IBadge) => b.isActive);

    const byCategory: Record<string, number> = {};
    const byRarity: Record<string, number> = {};

    allBadges.forEach((badge: IBadge) => {
      byCategory[badge.category] = (byCategory[badge.category] || 0) + 1;
      byRarity[badge.rarity] = (byRarity[badge.rarity] || 0) + 1;
    });

    return {
      totalBadges: allBadges.length,
      activeBadges: activeBadges.length,
      byCategory,
      byRarity
    };
  }
}

// Export singleton instance
export const badgeService = new BadgeService();
