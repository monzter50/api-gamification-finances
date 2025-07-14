import mongoose, { Schema, Document } from 'mongoose';
import type { IAchievement } from '@/types/index.js';

const achievementSchema = new Schema<IAchievement>({
  name: {
    type: String,
    required: [true, 'El nombre del logro es requerido'],
    unique: true,
    trim: true
  },
  description: {
    type: String,
    required: [true, 'La descripción del logro es requerida'],
    trim: true
  },
  icon: {
    type: String,
    required: [true, 'El ícono del logro es requerido'],
    trim: true
  },
  category: {
    type: String,
    enum: ['financial', 'savings', 'tracking', 'streak', 'milestone'],
    required: true
  },
  criteria: {
    type: {
      type: String,
      enum: ['transaction_count', 'total_amount', 'savings_goal', 'streak_days', 'level_reached'],
      required: true
    },
    value: {
      type: Number,
      required: true,
      min: 1
    },
    timeframe: {
      type: String,
      enum: ['all_time', 'monthly', 'weekly', 'daily'],
      default: 'all_time'
    }
  },
  reward: {
    experience: {
      type: Number,
      default: 0,
      min: 0
    },
    coins: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  rarity: {
    type: String,
    enum: ['common', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  unlockDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
achievementSchema.index({ category: 1 });
achievementSchema.index({ rarity: 1 });
achievementSchema.index({ 'criteria.type': 1 });

// Virtual for rarity color
achievementSchema.virtual('rarityColor').get(function() {
  const colors = {
    common: '#9e9e9e',
    rare: '#2196f3',
    epic: '#9c27b0',
    legendary: '#ff9800'
  };
  return colors[this.rarity] || colors.common;
});

// Static method to check if user qualifies for achievement
achievementSchema.statics.checkUserAchievements = async function(userId: string, userStats: any) {
  const achievements = await this.find({ isActive: true });
  const qualifiedAchievements = [];

  for (const achievement of achievements) {
    let qualifies = false;

    switch (achievement.criteria.type) {
      case 'transaction_count':
        qualifies = userStats.totalTransactions >= achievement.criteria.value;
        break;
      case 'total_amount':
        qualifies = userStats.totalSavings >= achievement.criteria.value;
        break;
      case 'savings_goal':
        qualifies = userStats.savingsGoalReached;
        break;
      case 'streak_days':
        qualifies = userStats.currentStreak >= achievement.criteria.value;
        break;
      case 'level_reached':
        qualifies = userStats.level >= achievement.criteria.value;
        break;
    }

    if (qualifies) {
      qualifiedAchievements.push(achievement);
    }
  }

  return qualifiedAchievements;
};

export const Achievement = mongoose.model<IAchievement>('Achievement', achievementSchema); 