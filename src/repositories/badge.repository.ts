import { BaseRepository } from './base.repository';
import { Badge, IBadge } from '../models/Badge';
import { Types } from 'mongoose';

/**
 * Badge Repository
 * Handles all database operations for Badge entity
 */
export class BadgeRepository extends BaseRepository<IBadge> {
  constructor() {
    super(Badge);
  }

  /**
   * Find badge by name
   */
  async findByName(name: string): Promise<IBadge | null> {
    return this.model
      .findOne({ name })
      .exec();
  }

  /**
   * Find all active badges
   */
  async findActive(): Promise<IBadge[]> {
    return this.model
      .find({ isActive: true })
      .sort({ rarity: 1, name: 1 })
      .exec();
  }

  /**
   * Find available badges (considering time limits)
   */
  async findAvailable(): Promise<IBadge[]> {
    const now = new Date();
    return this.model
      .find({
        isActive: true,
        $or: [
          { isLimited: false },
          {
            isLimited: true,
            availableFrom: { $lte: now },
            availableUntil: { $gte: now }
          }
        ]
      })
      .sort({ rarity: 1, name: 1 })
      .exec();
  }

  /**
   * Find badges by category
   */
  async findByCategory(category: string): Promise<IBadge[]> {
    return this.model
      .find({ category, isActive: true })
      .sort({ rarity: 1, name: 1 })
      .exec();
  }

  /**
   * Find badges by rarity
   */
  async findByRarity(rarity: string): Promise<IBadge[]> {
    return this.model
      .find({ rarity, isActive: true })
      .sort({ name: 1 })
      .exec();
  }

  /**
   * Find limited time badges
   */
  async findLimited(): Promise<IBadge[]> {
    return this.model
      .find({ isLimited: true, isActive: true })
      .sort({ availableUntil: 1 })
      .exec();
  }

  /**
   * Check if user meets badge criteria
   */
  async checkCriteria(badgeId: string | Types.ObjectId, userValue: number): Promise<boolean> {
    const badgeIdStr = typeof badgeId === 'string' ? badgeId : badgeId.toString();
    const badge = await this.findById(badgeIdStr);
    if (!badge) {
      throw new Error('Badge not found');
    }

    return userValue >= badge.criteria.value;
  }

  /**
   * Get badges that user can unlock based on their stats
   */
  async findUnlockableBadges(userStats: {
    achievementCount?: number;
    level?: number;
    coinsEarned?: number;
    totalSavings?: number;
    streakDays?: number;
  }): Promise<IBadge[]> {
    const availableBadges = await this.findAvailable();

    return availableBadges.filter(badge => {
      switch (badge.criteria.type) {
        case 'achievement_count':
          return (userStats.achievementCount || 0) >= badge.criteria.value;
        case 'level_reached':
          return (userStats.level || 0) >= badge.criteria.value;
        case 'coins_earned':
          return (userStats.coinsEarned || 0) >= badge.criteria.value;
        case 'savings_milestone':
          return (userStats.totalSavings || 0) >= badge.criteria.value;
        case 'streak_days':
          return (userStats.streakDays || 0) >= badge.criteria.value;
        case 'special_event':
          return false; // Special events need manual unlocking
        default:
          return false;
      }
    });
  }

  /**
   * Deactivate a badge
   */
  async deactivate(badgeId: string | Types.ObjectId): Promise<IBadge> {
    const badgeIdStr = typeof badgeId === 'string' ? badgeId : badgeId.toString();
    const badge = await this.findById(badgeIdStr);
    if (!badge) {
      throw new Error('Badge not found');
    }

    badge.isActive = false;
    return badge.save();
  }

  /**
   * Activate a badge
   */
  async activate(badgeId: string | Types.ObjectId): Promise<IBadge> {
    const badgeIdStr = typeof badgeId === 'string' ? badgeId : badgeId.toString();
    const badge = await this.findById(badgeIdStr);
    if (!badge) {
      throw new Error('Badge not found');
    }

    badge.isActive = true;
    return badge.save();
  }
}

// Export singleton instance
export const badgeRepository = new BadgeRepository();
