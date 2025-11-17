import { BaseRepository } from './base.repository';
import { Achievement } from '../models/Achievement';
import { IAchievement } from '../types';

/**
 * Achievement Repository
 * Handles all database operations for Achievement entity
 */
export class AchievementRepository extends BaseRepository<IAchievement> {
  constructor() {
    super(Achievement);
  }

  /**
   * Get all active achievements
   */
  async findActiveAchievements(): Promise<IAchievement[]> {
    return this.model
      .find({ isActive: true })
      .sort({ rarity: 1, name: 1 })
      .exec();
  }

  /**
   * Get achievements by category
   */
  async findByCategory(category: string): Promise<IAchievement[]> {
    return this.model
      .find({ category, isActive: true })
      .sort({ rarity: 1, name: 1 })
      .exec();
  }

  /**
   * Get achievements by rarity
   */
  async findByRarity(rarity: string): Promise<IAchievement[]> {
    return this.model
      .find({ rarity, isActive: true })
      .sort({ name: 1 })
      .exec();
  }

  /**
   * Check if user meets achievement criteria
   */
  async checkCriteria(achievementId: string, userStats: any): Promise<boolean> {
    const achievement = await this.findById(achievementId);
    if (!achievement) return false;

    const { criteria } = achievement;

    switch (criteria.type) {
      case 'transaction_count':
        return userStats.transactionCount >= criteria.value;
      case 'total_amount':
        return userStats.totalAmount >= criteria.value;
      case 'savings_goal':
        return userStats.totalSavings >= criteria.value;
      case 'streak_days':
        return userStats.streakDays >= criteria.value;
      case 'level_reached':
        return userStats.level >= criteria.value;
      default:
        return false;
    }
  }
}

// Export singleton instance
export const achievementRepository = new AchievementRepository();
