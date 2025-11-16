/**
 * User Request DTOs
 * Define the structure of incoming user-related requests
 */

export interface UpdateProfileRequestDto {
  name?: string;
  savingsGoal?: number;
}

export interface AddExperienceRequestDto {
  amount: number;
}

export interface SpendCoinsRequestDto {
  amount: number;
  description?: string;
}
