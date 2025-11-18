import { BaseRepository } from './base.repository';
import { UserProgress, IUserProgress } from '../models/UserProgress';
import { Types } from 'mongoose';

/**
 * UserProgress Repository
 * Handles all database operations for UserProgress entity
 */
export class UserProgressRepository extends BaseRepository<IUserProgress> {
  constructor() {
    super(UserProgress);
  }

  /**
   * Find progress by user ID
   */
  async findByUserId(userId: string | Types.ObjectId): Promise<IUserProgress | null> {
    return this.model
      .findOne({ userId })
      .populate('achievements')
      .populate('badges')
      .exec();
  }

  /**
   * Create progress for user
   */
  async createForUser(userId: string | Types.ObjectId): Promise<IUserProgress> {
    const progress = new this.model({
      userId,
      level: 1,
      experience: 0,
      experienceToNextLevel: 100,
      levelProgress: 0,
      achievements: [],
      badges: []
    });

    return progress.save();
  }

  /**
   * Add experience to user's progress
   */
  async addExperience(userId: string | Types.ObjectId, amount: number): Promise<{
    progress: IUserProgress;
    result: { leveledUp: boolean; newLevel?: number; experienceGained: number };
  }> {
    const progress = await this.findByUserId(userId);
    if (!progress) {
      throw new Error('User progress not found');
    }

    const result = progress.addExperience(amount);
    await progress.save();

    return { progress, result };
  }

  /**
   * Unlock achievement for user
   */
  async unlockAchievement(userId: string | Types.ObjectId, achievementId: Types.ObjectId): Promise<IUserProgress> {
    const progress = await this.findByUserId(userId);
    if (!progress) {
      throw new Error('User progress not found');
    }

    progress.unlockAchievement(achievementId);
    return progress.save();
  }

  /**
   * Check if user has achievement
   */
  async hasAchievement(userId: string | Types.ObjectId, achievementId: Types.ObjectId): Promise<boolean> {
    const progress = await this.findByUserId(userId);
    if (!progress) {
      return false;
    }

    return progress.hasAchievement(achievementId);
  }

  /**
   * Get leaderboard by level and experience
   */
  async getLeaderboard(limit: number = 10, skip: number = 0): Promise<IUserProgress[]> {
    return this.model
      .find()
      .sort({ level: -1, experience: -1 })
      .limit(limit)
      .skip(skip)
      .populate('userId', 'name email')
      .exec();
  }

  /**
   * Get user's rank on leaderboard
   */
  async getUserRank(userId: string | Types.ObjectId): Promise<number> {
    const userProgress = await this.findByUserId(userId);
    if (!userProgress) {
      return 0;
    }

    const rank = await this.model.countDocuments({
      $or: [
        { level: { $gt: userProgress.level } },
        {
          level: userProgress.level,
          experience: { $gt: userProgress.experience }
        }
      ]
    });

    return rank + 1;
  }

  /**
   * Get users by level
   */
  async findByLevel(level: number): Promise<IUserProgress[]> {
    return this.model
      .find({ level })
      .populate('userId', 'name email')
      .exec();
  }
}

// Export singleton instance
export const userProgressRepository = new UserProgressRepository();
