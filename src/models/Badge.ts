import mongoose, { Schema, Document } from 'mongoose';

/**
 * Badge Interface
 * Represents a special badge that can be earned by users
 */
export interface IBadge extends Document {
  name: string;
  description: string;
  icon: string;
  category: 'achievement' | 'milestone' | 'special' | 'seasonal' | 'event';
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'unique';
  criteria: {
    type: 'achievement_count' | 'level_reached' | 'coins_earned' | 'savings_milestone' | 'streak_days' | 'special_event';
    value: number;
    description: string;
  };
  isActive: boolean;
  isLimited: boolean; // Limited time availability
  availableFrom?: Date;
  availableUntil?: Date;
  rarityColor: string;
  createdAt: Date;
  updatedAt: Date;
}

const badgeSchema = new Schema<IBadge>({
  name: {
    type: String,
    required: [true, 'Badge name is required'],
    trim: true,
    unique: true,
    minlength: [3, 'Badge name must be at least 3 characters']
  },
  description: {
    type: String,
    required: [true, 'Badge description is required'],
    trim: true,
    minlength: [10, 'Badge description must be at least 10 characters']
  },
  icon: {
    type: String,
    required: [true, 'Badge icon is required'],
    default: '🏅'
  },
  category: {
    type: String,
    enum: ['achievement', 'milestone', 'special', 'seasonal', 'event'],
    required: true,
    default: 'achievement'
  },
  rarity: {
    type: String,
    enum: ['common', 'rare', 'epic', 'legendary', 'unique'],
    required: true,
    default: 'common'
  },
  criteria: {
    type: {
      type: String,
      enum: ['achievement_count', 'level_reached', 'coins_earned', 'savings_milestone', 'streak_days', 'special_event'],
      required: true
    },
    value: {
      type: Number,
      required: true,
      min: 0
    },
    description: {
      type: String,
      required: true,
      trim: true
    }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isLimited: {
    type: Boolean,
    default: false
  },
  availableFrom: {
    type: Date
  },
  availableUntil: {
    type: Date
  },
  rarityColor: {
    type: String,
    default: '#808080' // Gray for common
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
badgeSchema.index({ rarity: 1, category: 1 });
badgeSchema.index({ isActive: 1, isLimited: 1 });

// Virtual property to check if badge is currently available
badgeSchema.virtual('isAvailable').get(function() {
  if (!this.isActive) return false;
  if (!this.isLimited) return true;

  const now = new Date();
  if (this.availableFrom && now < this.availableFrom) return false;
  if (this.availableUntil && now > this.availableUntil) return false;

  return true;
});

// Pre-save hook to set rarity color
badgeSchema.pre('save', function(next) {
  if (this.isModified('rarity')) {
    switch (this.rarity) {
      case 'common':
        this.rarityColor = '#808080'; // Gray
        break;
      case 'rare':
        this.rarityColor = '#0070dd'; // Blue
        break;
      case 'epic':
        this.rarityColor = '#a335ee'; // Purple
        break;
      case 'legendary':
        this.rarityColor = '#ff8000'; // Orange
        break;
      case 'unique':
        this.rarityColor = '#e6cc80'; // Gold
        break;
      default:
        this.rarityColor = '#808080';
    }
  }
  next();
});

// Static method to find active badges
badgeSchema.statics.findActive = function() {
  return this.find({ isActive: true }).sort({ rarity: 1, name: 1 });
};

// Static method to find available badges (considering time limits)
badgeSchema.statics.findAvailable = function() {
  const now = new Date();
  return this.find({
    isActive: true,
    $or: [
      { isLimited: false },
      {
        isLimited: true,
        availableFrom: { $lte: now },
        availableUntil: { $gte: now }
      }
    ]
  }).sort({ rarity: 1, name: 1 });
};

export const Badge = mongoose.model<IBadge>('Badge', badgeSchema);
