import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  role: 'user' | 'admin';
  level: number;
  experience: number;
  coins: number;
  achievements: Types.ObjectId[];
  badges: Types.ObjectId[];
  totalSavings: number;
  totalExpenses: number;
  savingsGoal: number;
  isActive: boolean;
  lastLogin: Date;
  experienceToNextLevel: number;
  levelProgress: number;
  createdAt: Date;
  updatedAt: Date;
  addExperience(amount: number): {
    leveledUp: boolean;
    newLevel?: number;
    experienceGained: number;
  };
  addCoins(amount: number): number;
  canAfford(cost: number): boolean;
  spendCoins(amount: number): number;
}

const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters']
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
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
  coins: {
    type: Number,
    default: 0,
    min: 0
  },
  achievements: [{
    type: Schema.Types.ObjectId,
    ref: 'Achievement'
  }],
  badges: [{
    type: Schema.Types.ObjectId,
    ref: 'Badge'
  }],
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
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: Date.now
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
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ level: -1, experience: -1 });
userSchema.index({ coins: -1 });
userSchema.index({ totalSavings: -1 });

// Static method to find user by email
userSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to check if user exists
userSchema.statics.userExists = function(email: string) {
  return this.exists({ email: email.toLowerCase() });
};

// Instance method to add experience and check for level up
userSchema.methods.addExperience = function(amount: number) {
  const oldLevel = this.level;
  this.experience += amount;
  
  // Calculate experience needed for next level (simple formula)
  const experienceForNextLevel = this.level * 100;
  
  if (this.experience >= experienceForNextLevel) {
    this.level += 1;
    this.experienceToNextLevel = (this.level + 1) * 100;
    this.levelProgress = 0;
    
    return {
      leveledUp: true,
      newLevel: this.level,
      experienceGained: amount
    };
  } else {
    this.experienceToNextLevel = experienceForNextLevel;
    this.levelProgress = Math.round((this.experience / experienceForNextLevel) * 100);
    
    return {
      leveledUp: false,
      experienceGained: amount
    };
  }
};

// Instance method to add coins
userSchema.methods.addCoins = function(amount: number): number {
  this.coins += amount;
  return this.coins;
};

// Instance method to check if user can afford something
userSchema.methods.canAfford = function(cost: number): boolean {
  return this.coins >= cost;
};

// Instance method to spend coins
userSchema.methods.spendCoins = function(amount: number): number {
  if (this.canAfford(amount)) {
    this.coins -= amount;
    return this.coins;
  }
  throw new Error('Insufficient coins');
};

export const User = mongoose.model<IUser>('User', userSchema); 