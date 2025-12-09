# Budget Management API Documentation

## Overview
Complete RESTful API for budget management with nested routes for income and expense items. Income items now include a `type` field to categorize different payment methods.

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

### Income Item Schema
```typescript
interface IncomeItem {
  _id: string;
  description: string;
  amount: number;         // Must be >= 0
  type: IncomeType;       // Required: Payment method type
}

type IncomeType =
  | 'Debit Card'
  | 'Credit Card'
  | 'Cash'
  | 'Vales'
  | 'Transfer'
  | 'Check'
  | 'Other';
```

### Expense Item Schema
```typescript
interface ExpenseItem {
  _id: string;
  description: string;
  amount: number;         // Must be >= 0
}
```

---

## Income Type Enum

The `type` field for income items accepts the following values:

| Type | Description | Use Case |
|------|-------------|----------|
| `Debit Card` | Debit card payment | Regular purchases, ATM withdrawals |
| `Credit Card` | Credit card payment | Credit purchases, installments |
| `Cash` | Cash payment | Physical money transactions |
| `Vales` | Vouchers/Coupons | Food vouchers, gift cards |
| `Transfer` | Bank transfer | Salary, wire transfers |
| `Check` | Check payment | Business payments |
| `Other` | Other payment methods | Any other payment type |

**Default Value:** `'Other'`

---

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/budgets` | Get all budgets (with filters) |
| GET | `/api/budgets/stats` | Get budget statistics |
| GET | `/api/budgets/:id` | Get budget by ID |
| POST | `/api/budgets` | Create new budget |
| PUT | `/api/budgets/:id` | Update budget |
| DELETE | `/api/budgets/:id` | Delete budget |
| **POST** | `/api/budgets/:id/income` | **Add single income item** |
| PATCH | `/api/budgets/:id/income` | Update all income items |
| DELETE | `/api/budgets/:id/income/:itemId` | Delete income item |
| **POST** | `/api/budgets/:id/expense` | **Add single expense item** |
| PATCH | `/api/budgets/:id/expense` | Update all expense items |
| DELETE | `/api/budgets/:id/expense/:itemId` | Delete expense item |

---

## Detailed Endpoints

### 1. Create Budget
**POST** `/api/budgets`

**Request Body:**
```json
{
  "year": 2025,
  "month": 11,
  "incomeItems": [
    {
      "description": "Salary",
      "amount": 35000,
      "type": "Transfer"
    }
  ],
  "expenseItems": [
    {
      "description": "Rent",
      "amount": 12000
    }
  ]
}
```

### 2. Add Single Income Item ⭐ NEW
**POST** `/api/budgets/:id/income`

**Request Body:**
```json
{
  "description": "Bonus",
  "amount": 5000,
  "type": "Cash"
}
```

**Validation:**
- `description`: Required, non-empty string
- `amount`: Required, number >= 0
- `type`: **Required**, must be one of the valid income types

### 3. Add Single Expense Item ⭐ NEW
**POST** `/api/budgets/:id/expense`

**Request Body:**
```json
{
  "description": "Utilities",
  "amount": 1500
}
```

### 4. Update All Income Items
**PATCH** `/api/budgets/:id/income`

**Request Body:**
```json
{
  "incomeItems": [
    {
      "description": "Salary",
      "amount": 35000,
      "type": "Transfer"
    },
    {
      "description": "Freelance",
      "amount": 8000,
      "type": "Debit Card"
    }
  ]
}
```

**Note:** All items must include the `type` field.

---

## Budget Instance Methods

### `getIncomeByType(type: IncomeType)`
Filter income items by payment type.

```typescript
const cashIncome = budget.getIncomeByType('Cash');
```

### `getIncomeTotalsByType()`
Get total income amounts grouped by type.

```typescript
const totals = budget.getIncomeTotalsByType();
// Returns: { 'Transfer': 35000, 'Cash': 5000, 'Debit Card': 8000 }
```

---

## Usage Examples

### Create Budget with Income Types
```bash
curl -X POST http://localhost:3000/api/budgets \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2025,
    "month": 0,
    "incomeItems": [
      {
        "description": "Salary",
        "amount": 35000,
        "type": "Transfer"
      }
    ],
    "expenseItems": [
      {"description": "Rent", "amount": 12000}
    ]
  }'
```

### Add Single Income Item
```bash
curl -X POST http://localhost:3000/api/budgets/BUDGET_ID/income \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Bonus",
    "amount": 5000,
    "type": "Cash"
  }'
```

### Add Single Expense Item
```bash
curl -X POST http://localhost:3000/api/budgets/BUDGET_ID/expense \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Groceries",
    "amount": 3000
  }'
```

---

## Virtual Properties

All budgets automatically include:
- **totalIncome**: Sum of all income amounts
- **totalExpense**: Sum of all expense amounts
- **netSavings**: totalIncome - totalExpense
- **savingsRate**: (netSavings / totalIncome) × 100

---

## Error Responses

```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400,
  "errors": [ /* Validation errors */ ]
}
```

**Common Status Codes:**
- `400` - Validation error
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Duplicate budget
- `500` - Server Error

---

## Features

✅ **Income Type Classification** - Track payment methods
✅ **POST Endpoints for Single Items** - Add items one at a time
✅ **Auto-calculations** - Virtual properties computed automatically
✅ **Ownership Validation** - Secure user data
✅ **Comprehensive Validation** - Type checking and enum validation
✅ **Nested Routes** - Clean RESTful structure

---

## Architecture

```
📁 Budget Feature
├── Budget.ts - Model with Income Types Enum
├── budget.repository.ts - Data Access
├── budget.service.ts - Business Logic + Type Validation
├── budget.controller.ts - HTTP Handlers
├── budget.validator.ts - Express Validator Rules
└── budgets.ts - Routes (including POST endpoints)
```

---

## Notes

- Month is 0-indexed (0 = January, 11 = December)
- Income `type` field is **required** and validated
- Default type is `'Other'` in the schema
- All amounts must be >= 0
- Year range: 2000-2100
- Timestamps managed automatically
