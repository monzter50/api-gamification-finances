import { BaseRepository } from './base.repository';
import { type User } from '@prisma/client';

/**
 * User Repository
 * Handles all database operations for User entity
 */
export class UserRepository extends BaseRepository<User> {
  constructor () {
    super('user');
  }

  /**
   * Find user by email (case-insensitive)
   */
  async findByEmail (email: string): Promise<User | null> {
    return await this.findOne({ email });
  }

  /**
   * Check if user exists by email
   */
  async existsByEmail (email: string): Promise<boolean> {
    return await this.exists({ email });
  }

  /**
   * Get user by ID without password field
   */
  async findByIdWithoutPassword (id: string): Promise<Partial<User> | null> {
    return this.model.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        // Session fields are needed by authenticateJWT to enforce single-session.
        sessionId: true,
        sessionLastActivityAt: true
        // Exclude password
      }
    });
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin (userId: string): Promise<User | null> {
    return await this.updateById(userId, { lastLogin: new Date() });
  }

  /**
   * Start (or replace) the user's active session. Called on login/register —
   * records the new sessionId, marks activity as "now", and bumps lastLogin in
   * the same write. Any previously issued token (with a different sid) is
   * immediately stale.
   */
  async startSession (userId: string, sessionId: string): Promise<User | null> {
    const now = new Date();
    return await this.updateById(userId, {
      sessionId,
      sessionLastActivityAt: now,
      lastLogin: now
    });
  }

  /**
   * Clear the user's active session (logout). Frees the single-session slot so
   * a fresh login is allowed immediately.
   */
  async clearSession (userId: string): Promise<User | null> {
    return await this.updateById(userId, {
      sessionId: null,
      sessionLastActivityAt: null
    });
  }

  /**
   * Slide the inactivity window forward. Called by authenticateJWT, throttled by
   * the caller so it writes at most ~once/minute per active user.
   */
  async touchSessionActivity (userId: string): Promise<void> {
    await this.updateById(userId, { sessionLastActivityAt: new Date() });
  }
}

// Export singleton instance
export const userRepository = new UserRepository();
