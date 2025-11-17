/**
 * Achievement Response DTOs
 * Define the structure of achievement-related responses
 */

export interface AchievementResponseDto {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  criteria: {
    type: string;
    value: number;
    timeframe: string;
  };
  reward: {
    experience: number;
    coins: number;
  };
  rarity: string;
  rarityColor: string;
  isActive: boolean;
}

export interface UserAchievementResponseDto extends AchievementResponseDto {
  isUnlocked: boolean;
  unlockDate: Date | null;
  progress: number;
}

export interface UserAchievementsListDto {
  achievements: UserAchievementResponseDto[];
  totalAchievements: number;
  unlockedAchievements: number;
  completionPercentage: number;
}

export interface UnlockAchievementResponseDto {
  achievement: {
    id: string;
    name: string;
    description: string;
    icon: string;
    rarity: string;
    rarityColor: string;
  };
  rewards: {
    experience: number;
    coins: number;
  };
  userStats: {
    level: number;
    experience: number;
    coins: number;
    totalAchievements: number;
  };
}

export interface AchievementProgressDto {
  achievement: {
    id: string;
    name: string;
    description: string;
    criteria: {
      type: string;
      value: number;
      timeframe: string;
    };
  };
  progress: {
    current: number;
    target: number;
    percentage: number;
    isCompleted: boolean;
  };
}
