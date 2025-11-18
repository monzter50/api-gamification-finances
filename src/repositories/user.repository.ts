import { BaseRepository } from './base.repository';
import { User, IUser } from '../models/User';

/**
 * User Repository
 * Handles all database operations for User entity
 */
export class UserRepository extends BaseRepository<IUser> {
  constructor() {
    super(User);
  }

  /**
   * Find user by email (case-insensitive)
   */
  async findByEmail(email: string): Promise<IUser | null> {
    return this.findOne({ email: email.toLowerCase() });
  }

  /**
   * Check if user exists by email
   */
  async existsByEmail(email: string): Promise<boolean> {
    return this.exists({ email: email.toLowerCase() });
  }

  /**
   * Get user by ID without password field
   */
  async findByIdWithoutPassword(id: string): Promise<IUser | null> {
    return this.model.findById(id).select('-password').exec();
  }


  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(userId: string): Promise<IUser | null> {
    return this.updateById(userId, { lastLogin: new Date() });
  }
}

// Export singleton instance
export const userRepository = new UserRepository();
