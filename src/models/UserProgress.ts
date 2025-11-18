import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * UserProgress Interface
 * Manages user's gamification progress (levels, experience, achievements)
 */
export interface IUserProgress extends Document {
  userId: Types.ObjectId;
  level: number;
  experience: number;
  experienceToNextLevel: number;
  levelProgress: number;
  achievements: Types.ObjectId[];
  badges: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  addExperience(amount: number): {
    leveledUp: boolean;
    newLevel?: number;
    experienceGained: number;
  };
  unlockAchievement(achievementId: Types.ObjectId): void;
  hasAchievement(achievementId: Types.ObjectId): boolean;
}

const userProgressSchema = new Schema<IUserProgress>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  level: {
    type: Number,
    default: 1,
    min: 1
  },
  experience: {
    type: Number,
    default: 0,
    min: 0
  },
  experienceToNextLevel: {
    type: Number,
    default: 100
  },
  levelProgress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  achievements: [{
    type: Schema.Types.ObjectId,
    ref: 'Achievement'
  }],
  badges: [{
    type: Schema.Types.ObjectId,
    ref: 'Badge'
  }]
}, {
  timestamps: true
});

// Indexes for leaderboard and rankings
userProgressSchema.index({ level: -1, experience: -1 });
userProgressSchema.index({ userId: 1, level: -1 });

// Instance method to add experience and check for level up
userProgressSchema.methods.addExperience = function(amount: number) {
  if (amount <= 0) {
    throw new Error('Experience amount must be positive');
  }

  const oldLevel = this.level;
  this.experience += amount;

  // Calculate experience needed for next level
  // Formula: level * 100 (can be customized)
  const experienceForNextLevel = this.level * 100;

  if (this.experience >= experienceForNextLevel) {
    // Level up!
    this.level += 1;
    this.experience = this.experience - experienceForNextLevel; // Carry over excess XP
    this.experienceToNextLevel = this.level * 100;
    this.levelProgress = Math.round((this.experience / this.experienceToNextLevel) * 100);

    return {
      leveledUp: true,
      newLevel: this.level,
      experienceGained: amount
    };
  } else {
    // No level up
    this.experienceToNextLevel = experienceForNextLevel;
    this.levelProgress = Math.round((this.experience / experienceForNextLevel) * 100);

    return {
      leveledUp: false,
      experienceGained: amount
    };
  }
};

// Instance method to unlock achievement
userProgressSchema.methods.unlockAchievement = function(achievementId: Types.ObjectId): void {
  if (!this.achievements) {
    this.achievements = [];
  }

  // Check if already unlocked
  const alreadyUnlocked = this.achievements.some(
    (id: Types.ObjectId) => id.toString() === achievementId.toString()
  );

  if (!alreadyUnlocked) {
    this.achievements.push(achievementId);
  }
};

// Instance method to check if user has achievement
userProgressSchema.methods.hasAchievement = function(achievementId: Types.ObjectId): boolean {
  if (!this.achievements) {
    return false;
  }

  return this.achievements.some(
    (id: Types.ObjectId) => id.toString() === achievementId.toString()
  );
};

export const UserProgress = mongoose.model<IUserProgress>('UserProgress', userProgressSchema);
