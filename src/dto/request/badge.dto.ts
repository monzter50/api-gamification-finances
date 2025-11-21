/**
 * Badge Request DTOs
 * Data Transfer Objects for badge-related requests
 */

/**
 * Create Badge Request DTO
 */
export interface CreateBadgeRequestDto {
  name: string;
  description: string;
  icon?: string;
  category: 'achievement' | 'milestone' | 'special' | 'seasonal' | 'event';
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'unique';
  criteria: {
    type: 'achievement_count' | 'level_reached' | 'coins_earned' | 'savings_milestone' | 'streak_days' | 'special_event';
    value: number;
    description: string;
  };
  isLimited?: boolean;
  availableFrom?: string; // ISO date string
  availableUntil?: string; // ISO date string
}

/**
 * Update Badge Request DTO
 */
export interface UpdateBadgeRequestDto {
  name?: string;
  description?: string;
  icon?: string;
  category?: 'achievement' | 'milestone' | 'special' | 'seasonal' | 'event';
  rarity?: 'common' | 'rare' | 'epic' | 'legendary' | 'unique';
  criteria?: {
    type: 'achievement_count' | 'level_reached' | 'coins_earned' | 'savings_milestone' | 'streak_days' | 'special_event';
    value: number;
    description: string;
  };
  isActive?: boolean;
  isLimited?: boolean;
  availableFrom?: string; // ISO date string
  availableUntil?: string; // ISO date string
}

/**
 * Award Badge Request DTO
 */
export interface AwardBadgeRequestDto {
  badgeId: string;
  userId?: string; // Optional, can be used by admin to award to specific user
}
