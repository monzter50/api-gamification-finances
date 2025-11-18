import { BaseRepository } from './base.repository';
import { UserWallet, IUserWallet } from '../models/UserWallet';
import { Types } from 'mongoose';

/**
 * UserWallet Repository
 * Handles all database operations for UserWallet entity
 */
export class UserWalletRepository extends BaseRepository<IUserWallet> {
  constructor() {
    super(UserWallet);
  }

  /**
   * Find wallet by user ID
   */
  async findByUserId(userId: string | Types.ObjectId): Promise<IUserWallet | null> {
    return this.model
      .findOne({ userId })
      .exec();
  }

  /**
   * Create wallet for user
   */
  async createForUser(userId: string | Types.ObjectId, initialCoins: number = 0): Promise<IUserWallet> {
    const wallet = new this.model({
      userId,
      coins: initialCoins,
      totalEarned: initialCoins,
      totalSpent: 0
    });

    return wallet.save();
  }

  /**
   * Add coins to user's wallet
   */
  async addCoins(userId: string | Types.ObjectId, amount: number, reason?: string): Promise<IUserWallet> {
    const wallet = await this.findByUserId(userId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    wallet.addCoins(amount, reason);
    return wallet.save();
  }

  /**
   * Spend coins from user's wallet
   */
  async spendCoins(userId: string | Types.ObjectId, amount: number, reason?: string): Promise<IUserWallet> {
    const wallet = await this.findByUserId(userId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    wallet.spendCoins(amount, reason);
    return wallet.save();
  }

  /**
   * Check if user can afford a cost
   */
  async canAfford(userId: string | Types.ObjectId, cost: number): Promise<boolean> {
    const wallet = await this.findByUserId(userId);
    if (!wallet) {
      return false;
    }

    return wallet.canAfford(cost);
  }

  /**
   * Get wallet balance
   */
  async getBalance(userId: string | Types.ObjectId): Promise<number> {
    const wallet = await this.findByUserId(userId);
    if (!wallet) {
      return 0;
    }

    return wallet.getBalance();
  }

  /**
   * Get top wallets by coins (leaderboard)
   */
  async getTopWallets(limit: number = 10): Promise<IUserWallet[]> {
    return this.model
      .find()
      .sort({ coins: -1 })
      .limit(limit)
      .populate('userId', 'name email')
      .exec();
  }
}

// Export singleton instance
export const userWalletRepository = new UserWalletRepository();
