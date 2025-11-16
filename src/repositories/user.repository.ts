import { BaseRepository } from './base.repository';
import { User, IUser } from '../models/User';

/**
 * User Repository
 * Handles all database operations for User entity
 */
export class UserRepository extends BaseRepository<IUser> {
  constructor() {
    super(User);
  }

  /**
   * Find user by email (case-insensitive)
   */
  async findByEmail(email: string): Promise<IUser | null> {
    return this.findOne({ email: email.toLowerCase() });
  }

  /**
   * Check if user exists by email
   */
  async existsByEmail(email: string): Promise<boolean> {
    return this.exists({ email: email.toLowerCase() });
  }

  /**
   * Get user by ID without password field
   */
  async findByIdWithoutPassword(id: string): Promise<IUser | null> {
    return this.model.findById(id).select('-password').exec();
  }

  /**
   * Get top users for leaderboard
   */
  async getLeaderboard(limit: number = 10): Promise<IUser[]> {
    return this.model
      .find({ isActive: true })
      .select('-password')
      .sort({ level: -1, experience: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Get users by level range
   */
  async findByLevelRange(minLevel: number, maxLevel: number): Promise<IUser[]> {
    return this.model
      .find({
        level: { $gte: minLevel, $lte: maxLevel },
        isActive: true
      })
      .select('-password')
      .exec();
  }

  /**
   * Get users who achieved their savings goal
   */
  async findUsersWithGoalAchieved(): Promise<IUser[]> {
    return this.model
      .find({
        $expr: { $gte: ['$totalSavings', '$savingsGoal'] },
        savingsGoal: { $gt: 0 },
        isActive: true
      })
      .select('-password')
      .exec();
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(userId: string): Promise<IUser | null> {
    return this.updateById(userId, { lastLogin: new Date() });
  }

  /**
   * Add experience to user
   */
  async addExperience(userId: string, amount: number): Promise<IUser | null> {
    const user = await this.findById(userId);
    if (!user) return null;

    user.addExperience(amount);
    return user.save();
  }

  /**
   * Add coins to user
   */
  async addCoins(userId: string, amount: number): Promise<IUser | null> {
    const user = await this.findById(userId);
    if (!user) return null;

    user.addCoins(amount);
    return user.save();
  }

  /**
   * Spend user coins
   */
  async spendCoins(userId: string, amount: number): Promise<IUser | null> {
    const user = await this.findById(userId);
    if (!user) return null;

    user.spendCoins(amount);
    return user.save();
  }

  /**
   * Update user statistics (savings/expenses)
   */
  async updateFinancialStats(
    userId: string,
    totalSavings?: number,
    totalExpenses?: number
  ): Promise<IUser | null> {
    const updateData: any = {};
    if (totalSavings !== undefined) updateData.totalSavings = totalSavings;
    if (totalExpenses !== undefined) updateData.totalExpenses = totalExpenses;

    return this.updateById(userId, updateData);
  }

  /**
   * Unlock achievement for user
   */
  async addAchievement(userId: string, achievementId: string): Promise<IUser | null> {
    return this.model
      .findByIdAndUpdate(
        userId,
        { $addToSet: { achievements: achievementId } },
        { new: true }
      )
      .exec();
  }
}

// Export singleton instance
export const userRepository = new UserRepository();
