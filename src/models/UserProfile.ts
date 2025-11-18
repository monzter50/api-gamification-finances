import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * UserProfile Interface
 * Manages user's financial tracking data (savings, expenses, goals)
 */
export interface IUserProfile extends Document {
  userId: Types.ObjectId;
  totalSavings: number;
  totalExpenses: number;
  savingsGoal: number;
  savingsProgress: number;
  createdAt: Date;
  updatedAt: Date;
  addSavings(amount: number): void;
  addExpense(amount: number): void;
  setSavingsGoal(goal: number): void;
  calculateSavingsProgress(): number;
  getSavingsRemaining(): number;
  isSavingsGoalReached(): boolean;
}

const userProfileSchema = new Schema<IUserProfile>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  totalSavings: {
    type: Number,
    default: 0,
    min: 0
  },
  totalExpenses: {
    type: Number,
    default: 0,
    min: 0
  },
  savingsGoal: {
    type: Number,
    default: 0,
    min: 0
  },
  savingsProgress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  }
}, {
  timestamps: true
});

// Indexes for performance
userProfileSchema.index({ userId: 1, savingsGoal: -1 });
userProfileSchema.index({ totalSavings: -1 });

// Instance method to add savings
userProfileSchema.methods.addSavings = function(amount: number): void {
  if (amount <= 0) {
    throw new Error('Savings amount must be positive');
  }

  this.totalSavings += amount;
  this.savingsProgress = this.calculateSavingsProgress();
};

// Instance method to add expense
userProfileSchema.methods.addExpense = function(amount: number): void {
  if (amount <= 0) {
    throw new Error('Expense amount must be positive');
  }

  this.totalExpenses += amount;
};

// Instance method to set savings goal
userProfileSchema.methods.setSavingsGoal = function(goal: number): void {
  if (goal < 0) {
    throw new Error('Savings goal cannot be negative');
  }

  this.savingsGoal = goal;
  this.savingsProgress = this.calculateSavingsProgress();
};

// Instance method to calculate savings progress
userProfileSchema.methods.calculateSavingsProgress = function(): number {
  if (this.savingsGoal === 0) {
    return 0;
  }

  const progress = (this.totalSavings / this.savingsGoal) * 100;
  return Math.min(Math.round(progress), 100);
};

// Instance method to get remaining amount to reach goal
userProfileSchema.methods.getSavingsRemaining = function(): number {
  if (this.savingsGoal === 0) {
    return 0;
  }

  const remaining = this.savingsGoal - this.totalSavings;
  return Math.max(remaining, 0);
};

// Instance method to check if savings goal is reached
userProfileSchema.methods.isSavingsGoalReached = function(): boolean {
  if (this.savingsGoal === 0) {
    return false;
  }

  return this.totalSavings >= this.savingsGoal;
};

export const UserProfile = mongoose.model<IUserProfile>('UserProfile', userProfileSchema);
