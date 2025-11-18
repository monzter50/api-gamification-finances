import { BaseRepository } from './base.repository';
import { UserProfile, IUserProfile } from '../models/UserProfile';
import { Types } from 'mongoose';

/**
 * UserProfile Repository
 * Handles all database operations for UserProfile entity
 */
export class UserProfileRepository extends BaseRepository<IUserProfile> {
  constructor() {
    super(UserProfile);
  }

  /**
   * Find profile by user ID
   */
  async findByUserId(userId: string | Types.ObjectId): Promise<IUserProfile | null> {
    return this.model
      .findOne({ userId })
      .exec();
  }

  /**
   * Create profile for user
   */
  async createForUser(userId: string | Types.ObjectId, savingsGoal: number = 0): Promise<IUserProfile> {
    const profile = new this.model({
      userId,
      totalSavings: 0,
      totalExpenses: 0,
      savingsGoal,
      savingsProgress: 0
    });

    return profile.save();
  }

  /**
   * Add savings to user's profile
   */
  async addSavings(userId: string | Types.ObjectId, amount: number): Promise<IUserProfile> {
    const profile = await this.findByUserId(userId);
    if (!profile) {
      throw new Error('User profile not found');
    }

    profile.addSavings(amount);
    return profile.save();
  }

  /**
   * Add expense to user's profile
   */
  async addExpense(userId: string | Types.ObjectId, amount: number): Promise<IUserProfile> {
    const profile = await this.findByUserId(userId);
    if (!profile) {
      throw new Error('User profile not found');
    }

    profile.addExpense(amount);
    return profile.save();
  }

  /**
   * Set savings goal
   */
  async setSavingsGoal(userId: string | Types.ObjectId, goal: number): Promise<IUserProfile> {
    const profile = await this.findByUserId(userId);
    if (!profile) {
      throw new Error('User profile not found');
    }

    profile.setSavingsGoal(goal);
    return profile.save();
  }

  /**
   * Get users who reached their savings goal
   */
  async findUsersWithGoalReached(): Promise<IUserProfile[]> {
    return this.model
      .find({
        savingsGoal: { $gt: 0 },
        $expr: { $gte: ['$totalSavings', '$savingsGoal'] }
      })
      .populate('userId', 'name email')
      .exec();
  }

  /**
   * Get top savers (leaderboard)
   */
  async getTopSavers(limit: number = 10): Promise<IUserProfile[]> {
    return this.model
      .find()
      .sort({ totalSavings: -1 })
      .limit(limit)
      .populate('userId', 'name email')
      .exec();
  }

  /**
   * Get savings statistics for a user
   */
  async getSavingsStats(userId: string | Types.ObjectId): Promise<{
    totalSavings: number;
    totalExpenses: number;
    savingsGoal: number;
    savingsProgress: number;
    savingsRemaining: number;
    isGoalReached: boolean;
    netSavings: number;
  } | null> {
    const profile = await this.findByUserId(userId);
    if (!profile) {
      return null;
    }

    return {
      totalSavings: profile.totalSavings,
      totalExpenses: profile.totalExpenses,
      savingsGoal: profile.savingsGoal,
      savingsProgress: profile.savingsProgress,
      savingsRemaining: profile.getSavingsRemaining(),
      isGoalReached: profile.isSavingsGoalReached(),
      netSavings: profile.totalSavings - profile.totalExpenses
    };
  }
}

// Export singleton instance
export const userProfileRepository = new UserProfileRepository();
