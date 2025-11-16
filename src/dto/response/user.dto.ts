/**
 * User Response DTOs
 * Define the structure of user-related responses
 */

export interface UserProfileResponseDto {
  id: string;
  email: string;
  name: string;
  role: string;
  level: number;
  experience: number;
  experienceToNextLevel: number;
  levelProgress: number;
  coins: number;
  totalSavings: number;
  totalExpenses: number;
  savingsGoal: number;
  savingsProgress?: number;
  achievements: string[];
  badges: string[];
  isActive: boolean;
  lastLogin: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserStatsResponseDto {
  level: number;
  experience: number;
  experienceToNextLevel: number;
  levelProgress: number;
  coins: number;
  totalSavings: number;
  totalExpenses: number;
  savingsGoal: number;
  savingsProgress: number;
  achievementsCount: number;
  badgesCount: number;
  accountAge: number;
  lastLoginDaysAgo: number;
}

export interface LevelUpResponseDto {
  leveledUp: boolean;
  newLevel?: number | undefined;
  experienceGained: number;
  currentExperience: number;
  experienceToNextLevel: number;
  rewardCoins?: number | undefined;
}
