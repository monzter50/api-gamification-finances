/**
 * Application constants
 */

// Transaction types
export const TRANSACTION_TYPES = {
  INCOME: 'income',
  EXPENSE: 'expense',
  SAVINGS: 'savings'
} as const;

// Transaction categories
export const TRANSACTION_CATEGORIES = {
  // Income categories
  SALARY: 'salary',
  FREELANCE: 'freelance',
  INVESTMENT: 'investment',
  BONUS: 'bonus',
  OTHER_INCOME: 'other_income',
  
  // Expense categories
  FOOD: 'food',
  TRANSPORT: 'transport',
  ENTERTAINMENT: 'entertainment',
  SHOPPING: 'shopping',
  HEALTH: 'health',
  EDUCATION: 'education',
  BILLS: 'bills',
  OTHER_EXPENSE: 'other_expense',
  
  // Savings categories
  EMERGENCY_FUND: 'emergency_fund',
  VACATION: 'vacation',
  INVESTMENT_SAVINGS: 'investment_savings',
  GOAL_SAVINGS: 'goal_savings'
} as const;

// User roles
export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin'
} as const;

// Achievement categories
export const ACHIEVEMENT_CATEGORIES = {
  FINANCIAL: 'financial',
  SAVINGS: 'savings',
  TRACKING: 'tracking',
  STREAK: 'streak',
  MILESTONE: 'milestone'
} as const;

// Achievement rarity levels
export const ACHIEVEMENT_RARITY = {
  COMMON: 'common',
  RARE: 'rare',
  EPIC: 'epic',
  LEGENDARY: 'legendary'
} as const;

// Achievement criteria types
export const ACHIEVEMENT_CRITERIA_TYPES = {
  TRANSACTION_COUNT: 'transaction_count',
  TOTAL_AMOUNT: 'total_amount',
  SAVINGS_GOAL: 'savings_goal',
  STREAK_DAYS: 'streak_days',
  LEVEL_REACHED: 'level_reached'
} as const;

// Gamification constants
export const GAMIFICATION = {
  // Experience calculation
  EXPERIENCE_MULTIPLIERS: {
    INCOME: 0.1,    // 10% of amount
    SAVINGS: 0.2,   // 20% of amount
    EXPENSE: 0.05   // 5% of amount
  },
  
  // Coin calculation
  COIN_MULTIPLIERS: {
    INCOME: 0.05,   // 5% of amount
    SAVINGS: 0.1,   // 10% of amount
    EXPENSE: 0.02   // 2% of amount
  },
  
  // Level progression
  EXPERIENCE_PER_LEVEL: 100, // Base experience needed per level
  
  // Default values
  DEFAULT_LEVEL: 1,
  DEFAULT_EXPERIENCE: 0,
  DEFAULT_COINS: 0
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500
} as const;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100
} as const;

// Validation rules
export const VALIDATION = {
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 30,
    PATTERN: /^[a-zA-Z0-9_]+$/
  },
  PASSWORD: {
    MIN_LENGTH: 6
  },
  NAME: {
    MAX_LENGTH: 50
  },
  DESCRIPTION: {
    MAX_LENGTH: 200
  },
  AMOUNT: {
    MIN: 0.01
  }
} as const;

// Time constants
export const TIME = {
  ONE_DAY: 24 * 60 * 60 * 1000,
  ONE_WEEK: 7 * 24 * 60 * 60 * 1000,
  ONE_MONTH: 30 * 24 * 60 * 60 * 1000
} as const;

// Type exports
export type TransactionType = typeof TRANSACTION_TYPES[keyof typeof TRANSACTION_TYPES];
export type TransactionCategory = typeof TRANSACTION_CATEGORIES[keyof typeof TRANSACTION_CATEGORIES];
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
export type AchievementCategory = typeof ACHIEVEMENT_CATEGORIES[keyof typeof ACHIEVEMENT_CATEGORIES];
export type AchievementRarity = typeof ACHIEVEMENT_RARITY[keyof typeof ACHIEVEMENT_RARITY];
export type AchievementCriteriaType = typeof ACHIEVEMENT_CRITERIA_TYPES[keyof typeof ACHIEVEMENT_CRITERIA_TYPES]; 