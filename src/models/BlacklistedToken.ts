import { PrismaClient } from '@prisma/client';

// Use a singleton instance
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prisma = global.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export interface IBlacklistedToken {
  id: string
  token: string
  userId: string
  expiresAt: Date
  createdAt: Date
}

export const BlacklistedToken = {
  /**
   * Check if a token is blacklisted
   */
  async isBlacklisted (token: string): Promise<boolean> {
    const result = await prisma.blacklistedToken.findUnique({
      where: { token }
    });
    return result !== null;
  },

  /**
   * Add a token to the blacklist
   */
  async blacklistToken (token: string, userId: string, expiresAt: Date): Promise<IBlacklistedToken> {
    const blackList = await prisma.blacklistedToken.create({
      data: {
        token,
        userId,
        expiresAt
      }
    });
    return blackList;
  },

  /**
   * Clean expired tokens (manual cleanup if needed)
   * Note: In production, you should set up a cron job or scheduled task
   */
  async cleanExpiredTokens (): Promise<number> {
    const result = await prisma.blacklistedToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
    return result.count;
  },

  /**
   * Find a blacklisted token by token string
   */
  async findByToken (token: string): Promise<IBlacklistedToken | null> {
    return await prisma.blacklistedToken.findUnique({
      where: { token }
    });
  },

  /**
   * Find all blacklisted tokens for a user
   */
  async findByUserId (userId: string): Promise<IBlacklistedToken[]> {
    return await prisma.blacklistedToken.findMany({
      where: { userId }
    });
  }
};
