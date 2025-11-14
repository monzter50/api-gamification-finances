# API Routes Documentation

This document provides a complete overview of all available API endpoints in the Gamification Finances API.

## Base URL

```
http://localhost:3000/api/v1
```

## Authentication

Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Endpoints Overview

### 🔐 Authentication Routes (`/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login user | No |
| POST | `/auth/logout` | Logout user | Yes |
| GET | `/auth/me` | Get current user profile | Yes |

### 👤 User Routes (`/users`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/users/profile` | Get user profile | Yes |
| PUT | `/users/profile` | Update user profile | Yes |
| GET | `/users/stats` | Get user statistics | Yes |

### 💰 Transaction Routes (`/transactions`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/transactions` | Get all user transactions | Yes |
| POST | `/transactions` | Create new transaction | Yes |
| GET | `/transactions/:id` | Get specific transaction | Yes |
| PUT | `/transactions/:id` | Update transaction | Yes |
| DELETE | `/transactions/:id` | Delete transaction | Yes |
| GET | `/transactions/summary` | Get financial summary | Yes |
| GET | `/transactions/monthly/:year/:month` | Get monthly summary | Yes |

### 🏆 Achievement Routes (`/achievements`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/achievements` | Get all achievements | Yes |
| GET | `/achievements/user` | Get user achievements | Yes |
| POST | `/achievements/:id/unlock` | Unlock achievement | Yes |
| GET | `/achievements/:id/progress` | Get achievement progress | Yes |

### 🎮 Gamification Routes (`/gamification`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/gamification/profile` | Get gamification profile | Yes |
| POST | `/gamification/level-up` | Level up (testing) | Yes |
| GET | `/gamification/leaderboard` | Get leaderboard | Yes |
| GET | `/gamification/progress` | Get progress stats | Yes |
| POST | `/gamification/add-coins` | Add coins (testing) | Yes |

## Detailed Endpoint Documentation

### Authentication

#### POST `/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "userId": "user_id_here"
  }
}
```

#### POST `/auth/login`

Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "jwt_token_here"
  }
}
```

#### POST `/auth/logout`

Logout user and blacklist token.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### GET `/auth/me`

Get current user profile.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### User Management

#### GET `/users/profile`

Get detailed user profile with gamification data.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "level": 5,
    "experience": 450,
    "coins": 1250,
    "totalSavings": 5000,
    "totalExpenses": 3000,
    "savingsGoal": 10000,
    "isActive": true,
    "lastLogin": "2024-01-15T10:30:00Z",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### PUT `/users/profile`

Update user profile information.

**Request Body:**
```json
{
  "name": "John Smith",
  "savingsGoal": 15000
}
```

**Response:**
```json
{
  "success": true,
  "message": "Perfil actualizado correctamente",
  "data": {
    // Updated user profile
  }
}
```

#### GET `/users/stats`

Get comprehensive user statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalTransactions": 45,
    "currentStreak": 7,
    "totalSavings": 5000,
    "totalExpenses": 3000,
    "savingsGoal": 10000,
    "savingsProgress": 50.0,
    "savingsGoalReached": false,
    "level": 5,
    "experience": 450,
    "experienceToNextLevel": 550,
    "levelProgress": 45.0,
    "coins": 1250,
    "totalAchievements": 8,
    "totalBadges": 3,
    "isActive": true,
    "lastLogin": "2024-01-15T10:30:00Z",
    "daysSinceRegistration": 14
  }
}
```

### Transactions

#### GET `/transactions`

Get all user transactions (currently placeholder).

**Response:**
```json
{
  "success": true,
  "message": "Endpoint en desarrollo - Modelo de transacciones pendiente",
  "data": []
}
```

#### POST `/transactions`

Create a new transaction.

**Request Body:**
```json
{
  "type": "expense",
  "category": "Food",
  "amount": 25.50,
  "description": "Lunch at restaurant",
  "date": "2024-01-15T12:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transacción creada correctamente (endpoint en desarrollo)",
  "data": {
    "id": "temp-id",
    "type": "expense",
    "category": "Food",
    "amount": 25.50,
    "description": "Lunch at restaurant",
    "date": "2024-01-15T12:00:00Z",
    "userId": "user_id"
  }
}
```

#### GET `/transactions/summary`

Get financial summary.

**Response:**
```json
{
  "success": true,
  "data": {
    "income": {
      "total": 0,
      "count": 0,
      "experience": 0,
      "coins": 0
    },
    "expense": {
      "total": 3000,
      "count": 0,
      "experience": 0,
      "coins": 0
    },
    "savings": {
      "total": 5000,
      "count": 0,
      "experience": 0,
      "coins": 0
    },
    "netWorth": 2000,
    "savingsProgress": 50.0
  }
}
```

### Achievements

#### GET `/achievements`

Get all available achievements.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "achievement_id",
      "name": "First Savings",
      "description": "Save your first $100",
      "icon": "💰",
      "category": "savings",
      "criteria": {
        "type": "total_amount",
        "value": 100,
        "timeframe": "all_time"
      },
      "reward": {
        "experience": 50,
        "coins": 25
      },
      "rarity": "common",
      "rarityColor": "#4CAF50",
      "isActive": true
    }
  ]
}
```

#### GET `/achievements/user`

Get user achievements with unlock status.

**Response:**
```json
{
  "success": true,
  "data": {
    "achievements": [
      {
        "id": "achievement_id",
        "name": "First Savings",
        "description": "Save your first $100",
        "icon": "💰",
        "category": "savings",
        "criteria": {
          "type": "total_amount",
          "value": 100,
          "timeframe": "all_time"
        },
        "reward": {
          "experience": 50,
          "coins": 25
        },
        "rarity": "common",
        "rarityColor": "#4CAF50",
        "isUnlocked": true,
        "unlockDate": null,
        "progress": 0
      }
    ],
    "totalAchievements": 20,
    "unlockedAchievements": 8,
    "completionPercentage": 40
  }
}
```

#### POST `/achievements/:id/unlock`

Manually unlock an achievement (for testing).

**Response:**
```json
{
  "success": true,
  "message": "¡Logro desbloqueado: First Savings!",
  "data": {
    "achievement": {
      "id": "achievement_id",
      "name": "First Savings",
      "description": "Save your first $100",
      "icon": "💰",
      "rarity": "common",
      "rarityColor": "#4CAF50"
    },
    "rewards": {
      "experience": 50,
      "coins": 25
    },
    "userStats": {
      "level": 5,
      "experience": 500,
      "coins": 1275,
      "totalAchievements": 9
    }
  }
}
```

### Gamification

#### GET `/gamification/profile`

Get gamification profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "level": 5,
    "experience": 450,
    "experienceToNextLevel": 550,
    "levelProgress": 45.0,
    "coins": 1250,
    "totalSavings": 5000,
    "totalExpenses": 3000,
    "savingsGoal": 10000,
    "savingsProgress": 50.0,
    "achievements": {
      "total": 20,
      "unlocked": 8,
      "completionPercentage": 40
    },
    "badges": {
      "total": 10,
      "unlocked": 3
    },
    "stats": {
      "daysActive": 14,
      "lastLogin": "2024-01-15T10:30:00Z",
      "isActive": true
    }
  }
}
```

#### POST `/gamification/level-up`

Add experience and level up (for testing).

**Response:**
```json
{
  "success": true,
  "message": "¡Subiste al nivel 6!",
  "data": {
    "oldLevel": 5,
    "newLevel": 6,
    "oldExperience": 450,
    "newExperience": 550,
    "experienceGained": 100,
    "leveledUp": true,
    "levelProgress": 0,
    "experienceToNextLevel": 600,
    "coins": 1250
  }
}
```

#### GET `/gamification/leaderboard`

Get leaderboard with different sorting options.

**Query Parameters:**
- `type`: `level`, `coins`, `savings`, `experience` (default: `level`)
- `limit`: Number of results (default: 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "leaderboard": [
      {
        "position": 1,
        "name": "John Doe",
        "level": 10,
        "experience": 1500,
        "coins": 5000,
        "totalSavings": 25000,
        "totalExpenses": 15000
      }
    ],
    "type": "level",
    "limit": 10,
    "userPosition": 5,
    "userStats": {
      "name": "John Doe",
      "level": 5,
      "experience": 450,
      "coins": 1250,
      "totalSavings": 5000,
      "totalExpenses": 3000
    }
  }
}
```

#### GET `/gamification/progress`

Get progress statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "weekly": {
      "experience": 150,
      "coins": 75,
      "transactions": 12
    },
    "monthly": {
      "experience": 600,
      "coins": 300,
      "transactions": 45
    },
    "allTime": {
      "experience": 450,
      "coins": 1250,
      "transactions": 0,
      "level": 5,
      "achievements": 8
    }
  }
}
```

#### POST `/gamification/add-coins`

Add coins to user account (for testing).

**Request Body:**
```json
{
  "amount": 100
}
```

**Response:**
```json
{
  "success": true,
  "message": "Se añadieron 100 monedas",
  "data": {
    "oldCoins": 1250,
    "newCoins": 1350,
    "coinsAdded": 100
  }
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description"
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `404`: Not Found
- `409`: Conflict
- `500`: Internal Server Error

## Testing

### Health Check

```bash
curl http://localhost:3000/api/v1/health
```

### API Documentation

```bash
curl http://localhost:3000/api/v1/docs
```

### Authentication Flow

```bash
# 1. Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# 2. Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# 3. Use token for authenticated requests
curl -X GET http://localhost:3000/api/v1/users/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# 4. Logout
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Development Status

- ✅ **Authentication**: Complete with JWT and token blacklisting
- ✅ **User Management**: Complete with profile and stats
- ✅ **Achievements**: Complete with unlock system
- ✅ **Gamification**: Complete with leveling and leaderboards
- 🔄 **Transactions**: Placeholder endpoints (model pending)
- 🔄 **Badges**: Referenced but not implemented

## Notes

1. **Transaction Model**: Currently using placeholder responses. Implement when Transaction model is created.
2. **Testing Endpoints**: Some endpoints like `/gamification/level-up` and `/gamification/add-coins` are for testing purposes.
3. **Achievement Progress**: Progress calculation is placeholder. Implement based on actual criteria.
4. **Badge System**: Referenced in types but not implemented in routes.
5. **Streak Tracking**: Mentioned in stats but not implemented. 