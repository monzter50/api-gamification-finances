import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IBlacklistedToken extends Document {
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

// Define the interface for static methods
interface IBlacklistedTokenModel extends Model<IBlacklistedToken> {
  isBlacklisted(token: string): Promise<boolean>;
  blacklistToken(token: string, userId: string, expiresAt: Date): Promise<IBlacklistedToken>;
  cleanExpiredTokens(): Promise<any>;
}

const blacklistedTokenSchema = new Schema<IBlacklistedToken>({
  token: {
    type: String,
    required: [true, 'Token is required'],
    unique: true,
    index: true
  },
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    index: true
  },
  expiresAt: {
    type: Date,
    required: [true, 'Expiration date is required'],
    index: true
  }
}, {
  timestamps: true
});

// TTL index to automatically delete expired tokens
blacklistedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for faster queries
blacklistedTokenSchema.index({ token: 1, userId: 1 });

// Static method to check if token is blacklisted
blacklistedTokenSchema.statics.isBlacklisted = function(token: string) {
  return this.exists({ token });
};

// Static method to add token to blacklist
blacklistedTokenSchema.statics.blacklistToken = function(token: string, userId: string, expiresAt: Date) {
  return this.create({ token, userId, expiresAt });
};

// Static method to clean expired tokens (optional, TTL should handle this)
blacklistedTokenSchema.statics.cleanExpiredTokens = function() {
  return this.deleteMany({ expiresAt: { $lt: new Date() } });
};

export const BlacklistedToken = mongoose.model<IBlacklistedToken, IBlacklistedTokenModel>('BlacklistedToken', blacklistedTokenSchema); 