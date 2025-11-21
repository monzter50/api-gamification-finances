/**
 * Badge Response DTOs
 * Data Transfer Objects for badge-related responses
 */

/**
 * Badge Response DTO
 */
export interface BadgeResponseDto {
  id: string;
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
  isLimited: boolean;
  availableFrom?: Date;
  availableUntil?: Date;
  rarityColor: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Badge List Response DTO
 */
export interface BadgeListResponseDto {
  badges: BadgeResponseDto[];
  total: number;
}

/**
 * User Badge Response DTO
 */
export interface UserBadgeResponseDto {
  badge: BadgeResponseDto;
  earnedAt?: Date;
}

/**
 * Award Badge Response DTO
 */
export interface AwardBadgeResponseDto {
  badge: BadgeResponseDto;
  coinsAwarded: number;
  experienceAwarded: number;
  message: string;
}

/**
 * Badge Stats Response DTO
 */
export interface BadgeStatsResponseDto {
  totalBadges: number;
  activeBadges: number;
  byCategory: Record<string, number>;
  byRarity: Record<string, number>;
}

/**
 * Check Unlockable Badges Response DTO
 */
export interface UnlockableBadgesResponseDto {
  badgesAwarded: BadgeResponseDto[];
  totalCoins: number;
  totalExperience: number;
  count: number;
}
