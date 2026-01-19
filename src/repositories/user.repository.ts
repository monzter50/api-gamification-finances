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
        updatedAt: true
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
}

// Export singleton instance
export const userRepository = new UserRepository();
