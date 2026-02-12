import { userRepository } from '../repositories/user.repository';
import { type UpdateProfileRequestDto } from '../dto/request/user.dto';
import { type UserProfileResponseDto } from '../dto/response/user.dto';
import { logger } from '../config/logger';

/**
 * User Service
 * Handles business logic for user operations
 */
export class UserService {
  /**
   * Get user profile by ID
   */
  async getUserProfile (userId: string): Promise<UserProfileResponseDto> {
    const user = await userRepository.findByIdWithoutPassword(userId);

    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: (user as any).id,
      email: user.email ?? '',
      name: user.name ?? '',
      role: user.role ?? '',
      isActive: user.isActive ?? false,
      lastLogin: user.lastLogin ?? new Date(0),
      createdAt: user.createdAt ?? new Date(0),
      updatedAt: user.updatedAt ?? new Date(0)
    };
  }

  /**
   * Update user profile
   */
  async updateProfile (userId: string, data: UpdateProfileRequestDto): Promise<UserProfileResponseDto> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Update user name if provided
    if (data.name !== undefined) {
      await userRepository.updateById(userId, { name: data.name });
    }

    logger.info(`User profile updated: ${userId}`);

    return await this.getUserProfile(userId);
  }
}

// Export singleton instance
export const userService = new UserService();
