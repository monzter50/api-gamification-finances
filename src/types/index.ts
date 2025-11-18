import { Request } from 'express';
import { Document, Types } from 'mongoose';

// User types
export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  role: 'user' | 'admin';
  isActive: boolean;
  lastLogin: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Transaction types
export interface ITransaction extends Document {
  user: Types.ObjectId;
  type: 'income' | 'expense' | 'savings';
  category: string;
  amount: number;
  description: string;
  date: Date;
  experienceEarned: number;
  coinsEarned: number;
  tags?: string[];
  location?: string;
  receipt?: string;
  isRecurring: boolean;
  recurringFrequency?: 'weekly' | 'monthly' | 'yearly';
  createdAt: Date;
  updatedAt: Date;
  formattedAmount: string;
  status: 'positive' | 'negative' | 'neutral';
}

// Achievement types
export interface IAchievement extends Document {
  name: string;
  description: string;
  icon: string;
  category: 'financial' | 'savings' | 'tracking' | 'streak' | 'milestone';
  criteria: {
    type: 'transaction_count' | 'total_amount' | 'savings_goal' | 'streak_days' | 'level_reached';
    value: number;
    timeframe: 'all_time' | 'monthly' | 'weekly' | 'daily';
  };
  reward: {
    experience: number;
    coins: number;
  };
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  isActive: boolean;
  unlockDate?: Date;
  rarityColor: string;
}

// Request types
export interface JWTPayload {
  id: string;
  email: string;
  name: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: any;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Financial Summary types
export interface FinancialSummary {
  income: {
    total: number;
    count: number;
    experience: number;
    coins: number;
  };
  expense: {
    total: number;
    count: number;
    experience: number;
    coins: number;
  };
  savings: {
    total: number;
    count: number;
    experience: number;
    coins: number;
  };
}

// Gamification types
export interface GamificationProfile {
  level: number;
  experience: number;
  experienceToNextLevel: number;
  levelProgress: number;
  coins: number;
  totalSavings: number;
  totalExpenses: number;
  savingsGoal: number;
  savingsProgress: number;
}

export interface ProgressStats {
  weekly: {
    experience: number;
    coins: number;
    transactions: number;
  };
  monthly: {
    experience: number;
    coins: number;
    transactions: number;
  };
}

export interface LeaderboardEntry {
  position: number;
  username: string;
  fullName: string;
  level: number;
  experience: number;
  coins: number;
  totalSavings: number;
}

// Validation types
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// Environment types
export interface Environment {
  NODE_ENV: string;
  PORT: number;
  MONGODB_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  API_VERSION: string;
  CORS_ORIGIN: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  LOG_LEVEL: string;
}

// Transaction filters
export interface TransactionFilters {
  type?: 'income' | 'expense' | 'savings';
  category?: string;
  startDate?: Date;
  endDate?: Date;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// User stats
export interface UserStats {
  totalTransactions: number;
  totalSavings: number;
  savingsGoalReached: boolean;
  currentStreak: number;
  level: number;
}

// Achievement criteria
export interface AchievementCriteria {
  type: 'transaction_count' | 'total_amount' | 'savings_goal' | 'streak_days' | 'level_reached';
  value: number;
  timeframe: 'all_time' | 'monthly' | 'weekly' | 'daily';
}

// Level info
export interface LevelInfo {
  level: number;
  experienceNeeded: number;
  totalExperienceRequired: number;
  isCurrentLevel: boolean;
  isCompleted: boolean;
} 