import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * UserWallet Interface
 * Manages user's virtual currency (coins)
 */
export interface IUserWallet extends Document {
  userId: Types.ObjectId;
  coins: number;
  totalEarned: number;
  totalSpent: number;
  createdAt: Date;
  updatedAt: Date;
  addCoins(amount: number, reason?: string): number;
  canAfford(cost: number): boolean;
  spendCoins(amount: number, reason?: string): number;
  getBalance(): number;
}

const userWalletSchema = new Schema<IUserWallet>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  coins: {
    type: Number,
    default: 0,
    min: 0
  },
  totalEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  totalSpent: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// Indexes
userWalletSchema.index({ coins: -1 });

// Instance method to add coins
userWalletSchema.methods.addCoins = function(amount: number, reason?: string): number {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  this.coins += amount;
  this.totalEarned += amount;
  return this.coins;
};

// Instance method to check if user can afford something
userWalletSchema.methods.canAfford = function(cost: number): boolean {
  return this.coins >= cost;
};

// Instance method to spend coins
userWalletSchema.methods.spendCoins = function(amount: number, reason?: string): number {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  if (!this.canAfford(amount)) {
    throw new Error('Insufficient coins');
  }

  this.coins -= amount;
  this.totalSpent += amount;
  return this.coins;
};

// Instance method to get current balance
userWalletSchema.methods.getBalance = function(): number {
  return this.coins;
};

export const UserWallet = mongoose.model<IUserWallet>('UserWallet', userWalletSchema);
