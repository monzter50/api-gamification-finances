# Budget Management API Documentation

## Overview
Complete RESTful API for budget management with nested routes for income and expense items.

**Base URL:** `/api/budgets`

All endpoints require JWT authentication via the `Authorization` header:
```
Authorization: Bearer <your-jwt-token>
```

---

## Data Models

### Budget Schema
```typescript
interface Budget {
  _id: string;
  userId: ObjectId;
  year: number;           // 2000-2100
  month: number;          // 0-11 (January = 0, December = 11)
  incomeItems: IncomeItem[];
  expenseItems: ExpenseItem[];
  createdAt: Date;
  updatedAt: Date;
  // Virtual properties (auto-calculated)
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  savingsRate: number;    // Percentage (0-100)
}
```

### Income/Expense Item Schema
```typescript
interface IncomeItem {
  _id: string;
  description: string;
  amount: number;         // Must be >= 0
}

interface ExpenseItem {
  _id: string;
  description: string;
  amount: number;         // Must be >= 0
}
```

---

## API Endpoints

### 1. Get All Budgets
**GET** `/api/budgets`

Get all budgets for the authenticated user with optional filters.

**Query Parameters:**
- `year` (optional): Filter by year (2000-2100)
- `month` (optional): Filter by month (0-11)

**Example Request:**
```bash
GET /api/budgets?year=2025&month=11
```

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "userId": "507f1f77bcf86cd799439012",
      "year": 2025,
      "month": 11,
      "incomeItems": [
        {
          "_id": "507f1f77bcf86cd799439013",
          "description": "Salary",
          "amount": 35000
        }
      ],
      "expenseItems": [
        {
          "_id": "507f1f77bcf86cd799439014",
          "description": "Rent",
          "amount": 12000
        }
      ],
      "totalIncome": 35000,
      "totalExpense": 12000,
      "netSavings": 23000,
      "savingsRate": 65.71,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "message": "Budgets retrieved successfully"
}
```

---

### 2. Get Budget by ID
**GET** `/api/budgets/:id`

Get a specific budget by ID (must belong to authenticated user).

**Success Response (200):**
```json
{
  "success": true,
  "data": { /* Budget object */ },
  "message": "Budget retrieved successfully"
}
```

**Error Responses:**
- **404** - Budget not found
- **403** - Unauthorized access to budget

---

### 3. Create Budget
**POST** `/api/budgets`

Create a new budget for a specific month/year.

**Request Body:**
```json
{
  "year": 2025,
  "month": 11,
  "incomeItems": [
    {
      "description": "Salary",
      "amount": 35000
    },
    {
      "description": "Freelance",
      "amount": 8000
    }
  ],
  "expenseItems": [
    {
      "description": "Rent",
      "amount": 12000
    },
    {
      "description": "Groceries",
      "amount": 3000
    }
  ]
}
```

**Validation Rules:**
- `year`: Required, integer between 2000-2100
- `month`: Required, integer between 0-11
- `incomeItems`: Optional array (can be empty)
- `expenseItems`: Optional array (can be empty)
- Each item requires `description` (non-empty string) and `amount` (number >= 0)

**Success Response (201):**
```json
{
  "success": true,
  "data": { /* Created budget with all virtual properties */ },
  "message": "Budget created successfully"
}
```

**Error Responses:**
- **400** - Validation error
- **409** - Budget for this period already exists

---

### 4. Update Budget
**PUT** `/api/budgets/:id`

Update an entire budget (replaces all fields).

**Request Body:**
```json
{
  "year": 2025,
  "month": 11,
  "incomeItems": [ /* new array */ ],
  "expenseItems": [ /* new array */ ]
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": { /* Updated budget */ },
  "message": "Budget updated successfully"
}
```

**Error Responses:**
- **400** - Validation error
- **403** - Unauthorized access
- **404** - Budget not found

---

### 5. Delete Budget
**DELETE** `/api/budgets/:id`

Delete a budget permanently.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Budget deleted successfully"
}
```

**Error Responses:**
- **403** - Unauthorized access
- **404** - Budget not found

---

## Nested Routes - Income Items

### 6. Update Income Items
**PATCH** `/api/budgets/:id/income`

Replace all income items for a budget.

**Request Body:**
```json
{
  "incomeItems": [
    {
      "description": "Salary",
      "amount": 35000
    },
    {
      "description": "Freelance",
      "amount": 8000
    }
  ]
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": { /* Updated budget with new income items */ },
  "message": "Income items updated successfully"
}
```

**Error Responses:**
- **400** - Validation error (invalid items)
- **403** - Unauthorized access
- **404** - Budget not found

---

### 7. Delete Income Item
**DELETE** `/api/budgets/:id/income/:itemId`

Delete a specific income item from a budget.

**URL Parameters:**
- `id`: Budget ID
- `itemId`: Income item ID (_id from the incomeItems array)

**Success Response (200):**
```json
{
  "success": true,
  "data": { /* Updated budget without the deleted item */ },
  "message": "Income item deleted successfully"
}
```

**Error Responses:**
- **403** - Unauthorized access
- **404** - Budget not found

---

## Nested Routes - Expense Items

### 8. Update Expense Items
**PATCH** `/api/budgets/:id/expense`

Replace all expense items for a budget.

**Request Body:**
```json
{
  "expenseItems": [
    {
      "description": "Rent",
      "amount": 12000
    },
    {
      "description": "Utilities",
      "amount": 1500
    }
  ]
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": { /* Updated budget with new expense items */ },
  "message": "Expense items updated successfully"
}
```

**Error Responses:**
- **400** - Validation error (invalid items)
- **403** - Unauthorized access
- **404** - Budget not found

---

### 9. Delete Expense Item
**DELETE** `/api/budgets/:id/expense/:itemId`

Delete a specific expense item from a budget.

**URL Parameters:**
- `id`: Budget ID
- `itemId`: Expense item ID (_id from the expenseItems array)

**Success Response (200):**
```json
{
  "success": true,
  "data": { /* Updated budget without the deleted item */ },
  "message": "Expense item deleted successfully"
}
```

**Error Responses:**
- **403** - Unauthorized access
- **404** - Budget not found

---

### 10. Get Budget Statistics
**GET** `/api/budgets/stats`

Get aggregated statistics for all budgets of the authenticated user.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "totalBudgets": 12,
    "totalIncome": 420000,
    "totalExpenses": 280000,
    "totalSavings": 140000,
    "averageSavingsRate": 33.33
  },
  "message": "Budget statistics retrieved successfully"
}
```

---

## Virtual Properties Explained

All budgets automatically include these calculated fields:

1. **totalIncome**: Sum of all income item amounts
2. **totalExpense**: Sum of all expense item amounts
3. **netSavings**: totalIncome - totalExpense
4. **savingsRate**: (netSavings / totalIncome) × 100

These are computed on-the-fly and included in all API responses.

---

## Error Response Format

All error responses follow this structure:

```json
{
  "success": false,
  "error": "Error message description",
  "statusCode": 400,
  "errors": [ /* Validation errors (if applicable) */ ]
}
```

**Common Status Codes:**
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (not owner of resource)
- `404` - Not Found
- `409` - Conflict (duplicate budget)
- `500` - Internal Server Error

---

## Features

### ✅ Unique Constraint
- Only one budget per user/year/month combination
- Prevents duplicate budgets for the same period

### ✅ Auto-calculations
- Virtual properties automatically calculated
- No manual calculation needed

### ✅ Ownership Validation
- All operations verify the budget belongs to the authenticated user
- Prevents unauthorized access to other users' budgets

### ✅ Comprehensive Validation
- Express-validator middleware on all endpoints
- Type checking for all inputs
- Range validation for year (2000-2100) and month (0-11)
- Amount must be positive numbers

### ✅ Nested Routes
- Clean RESTful structure
- Income and expense items managed through parent budget

---

## Usage Examples

### Create a Monthly Budget
```bash
curl -X POST http://localhost:3000/api/budgets \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2025,
    "month": 0,
    "incomeItems": [
      {"description": "Salary", "amount": 35000}
    ],
    "expenseItems": [
      {"description": "Rent", "amount": 12000},
      {"description": "Food", "amount": 3000}
    ]
  }'
```

### Update Income Items
```bash
curl -X PATCH http://localhost:3000/api/budgets/BUDGET_ID/income \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "incomeItems": [
      {"description": "Salary", "amount": 40000},
      {"description": "Bonus", "amount": 5000}
    ]
  }'
```

### Get Budgets for Specific Year
```bash
curl -X GET "http://localhost:3000/api/budgets?year=2025" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Delete an Expense Item
```bash
curl -X DELETE http://localhost:3000/api/budgets/BUDGET_ID/expense/ITEM_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Architecture

The API follows a clean architecture pattern:

```
📁 Budget Feature
├── 📄 Budget.ts (Model - Mongoose Schema)
├── 📄 budget.repository.ts (Data Access Layer)
├── 📄 budget.service.ts (Business Logic)
├── 📄 budget.controller.ts (HTTP Handlers)
├── 📄 budget.validator.ts (Validation Rules)
└── 📄 budgets.ts (Routes Definition)
```

### Layers:
1. **Model**: Defines schema, virtuals, and instance methods
2. **Repository**: Database operations and queries
3. **Service**: Business logic and validation
4. **Controller**: HTTP request/response handling
5. **Validator**: Input validation using express-validator
6. **Routes**: Endpoint definitions with middleware

---

## Notes

- All dates are in ISO 8601 format
- Month is 0-indexed (January = 0, December = 11) to match JavaScript Date
- All monetary amounts are numbers (no currency symbol)
- Budget ID and Item IDs are MongoDB ObjectIds
- Timestamps (createdAt, updatedAt) are automatically managed
