import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Gamification Finances API',
      version: '1.0.0',
      description: 'API para gestión de finanzas personales con gamificación',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://api.production.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token in the format: Bearer <token>'
        }
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            response: {
              description: 'The actual data returned'
            },
            status: {
              type: 'string',
              enum: ['ok', 'error'],
              description: 'Status of the response'
            },
            statusCode: {
              type: 'number',
              description: 'HTTP status code'
            },
            headers: {
              type: 'object',
              additionalProperties: {
                type: 'string'
              }
            }
          }
        },
        Transaction: {
          type: 'object',
          required: ['id', 'type', 'amount', 'description', 'date', 'userId'],
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier',
              example: '507f1f77bcf86cd799439011'
            },
            type: {
              type: 'string',
              enum: ['income', 'expense', 'savings'],
              description: 'Type of transaction',
              example: 'expense'
            },
            amount: {
              type: 'number',
              format: 'float',
              minimum: 0.01,
              description: 'Amount in MXN',
              example: 150.50
            },
            description: {
              type: 'string',
              minLength: 1,
              description: 'Description of the transaction',
              example: 'Grocery shopping at supermarket'
            },
            date: {
              type: 'string',
              format: 'date',
              description: 'Date of the transaction (ISO 8601)',
              example: '2025-12-29'
            },
            userId: {
              type: 'string',
              description: 'ID of the user who owns this transaction',
              example: '507f1f77bcf86cd799439011'
            }
          }
        },
        CreateTransactionRequest: {
          type: 'object',
          required: ['type', 'amount', 'description', 'date'],
          properties: {
            type: {
              type: 'string',
              enum: ['income', 'expense', 'savings'],
              description: 'Type of transaction',
              example: 'expense'
            },
            amount: {
              type: 'number',
              format: 'float',
              minimum: 0.01,
              description: 'Amount in MXN',
              example: 150.50
            },
            description: {
              type: 'string',
              minLength: 1,
              description: 'Description of the transaction',
              example: 'Grocery shopping at supermarket'
            },
            date: {
              type: 'string',
              format: 'date',
              description: 'Date of the transaction (ISO 8601)',
              example: '2025-12-29'
            }
          }
        },
        TransactionSummary: {
          type: 'object',
          properties: {
            income: {
              type: 'object',
              properties: {
                total: { type: 'number', example: 50000 },
                count: { type: 'number', example: 5 },
                experience: { type: 'number', example: 100 },
                coins: { type: 'number', example: 50 }
              }
            },
            expense: {
              type: 'object',
              properties: {
                total: { type: 'number', example: 30000 },
                count: { type: 'number', example: 15 },
                experience: { type: 'number', example: 75 },
                coins: { type: 'number', example: 30 }
              }
            },
            savings: {
              type: 'object',
              properties: {
                total: { type: 'number', example: 20000 },
                count: { type: 'number', example: 3 },
                experience: { type: 'number', example: 50 },
                coins: { type: 'number', example: 20 }
              }
            },
            netWorth: {
              type: 'number',
              description: 'Income - Expense',
              example: 20000
            },
            savingsProgress: {
              type: 'number',
              description: 'Percentage of savings goal achieved',
              example: 65.5
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            response: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  example: 'An error occurred'
                },
                error: {
                  type: 'string',
                  example: 'Detailed error message'
                }
              }
            },
            status: {
              type: 'string',
              enum: ['error']
            },
            statusCode: {
              type: 'number',
              example: 400
            }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 10 },
            total: { type: 'integer', example: 25 },
            pages: { type: 'integer', example: 3 }
          }
        },
        IncomeItem: {
          type: 'object',
          required: ['id', 'description', 'amount', 'type', 'accountId'],
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier of the income item',
              example: 'inc_01HX5A2B3C4D5E6F'
            },
            description: {
              type: 'string',
              description: 'Description of the income item',
              example: 'Monthly salary'
            },
            amount: {
              type: 'number',
              format: 'float',
              minimum: 0.01,
              description: 'Amount in MXN',
              example: 25000.00
            },
            type: {
              type: 'string',
              enum: ['Debit Card', 'Credit Card', 'Cash', 'Vales', 'Transfer', 'Check', 'Other'],
              description: 'Payment/receipt method',
              example: 'Transfer'
            },
            accountId: {
              type: 'string',
              format: 'uuid',
              description: 'ID of the account this planned income will be deposited into. Required as of PR 1.',
              example: 'acc_01HX5A2B3C4D5E6F'
            }
          }
        },
        ExpenseItem: {
          type: 'object',
          required: ['id', 'description', 'amount', 'type'],
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier of the expense item',
              example: 'exp_01HX5A2B3C4D5E6F'
            },
            description: {
              type: 'string',
              description: 'Description of the expense item',
              example: 'Rent'
            },
            amount: {
              type: 'number',
              format: 'float',
              minimum: 0.01,
              description: 'Amount in MXN',
              example: 1200.00
            },
            type: {
              type: 'string',
              enum: ['Fixed', 'Variable'],
              description: 'Expense classification',
              example: 'Fixed'
            }
          }
        },
        AddIncomeItemRequest: {
          type: 'object',
          required: ['description', 'amount', 'type', 'accountId'],
          properties: {
            description: { type: 'string', minLength: 1, example: 'Monthly salary' },
            amount: { type: 'number', format: 'float', minimum: 0.01, example: 25000 },
            type: {
              type: 'string',
              enum: ['Debit Card', 'Credit Card', 'Cash', 'Vales', 'Transfer', 'Check', 'Other'],
              example: 'Transfer'
            },
            accountId: {
              type: 'string',
              format: 'uuid',
              description: 'Required. Must be an account owned by the authenticated user. Response 400 if the account does not belong to this user.',
              example: 'acc_01HX5A2B3C4D5E6F'
            }
          }
        },
        AddExpenseItemRequest: {
          type: 'object',
          required: ['description', 'amount', 'type'],
          properties: {
            description: { type: 'string', minLength: 1, example: 'Rent' },
            amount: { type: 'number', format: 'float', minimum: 0.01, example: 1200 },
            type: {
              type: 'string',
              enum: ['Fixed', 'Variable'],
              example: 'Fixed'
            }
          }
        },
        UpdateIncomeItemsRequest: {
          type: 'object',
          required: ['incomeItems'],
          properties: {
            incomeItems: {
              type: 'array',
              description: 'Full replacement of the income list for this budget',
              items: { $ref: '#/components/schemas/AddIncomeItemRequest' }
            }
          }
        },
        UpdateExpenseItemsRequest: {
          type: 'object',
          required: ['expenseItems'],
          properties: {
            expenseItems: {
              type: 'array',
              description: 'Full replacement of the expense list for this budget',
              items: { $ref: '#/components/schemas/AddExpenseItemRequest' }
            }
          }
        },
        BudgetMutationResponse: {
          type: 'object',
          description: 'Shape returned by bulk replace-all endpoints (PATCH /income, PATCH /expense). Includes the full enriched budget with both item lists.',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              description: 'Updated budget document with incomeItems[], expenseItems[], and derived totals'
            },
            message: { type: 'string', example: 'Income items updated successfully' }
          }
        },
        BudgetTotals: {
          type: 'object',
          description: 'Aggregate counters recomputed after any item-level mutation.',
          required: ['totalIncome', 'totalExpense', 'netSavings', 'savingsRate'],
          properties: {
            totalIncome: { type: 'number', format: 'float', example: 25000 },
            totalExpense: { type: 'number', format: 'float', example: 12000 },
            netSavings: { type: 'number', format: 'float', example: 13000 },
            savingsRate: { type: 'number', format: 'float', description: 'Percent (0-100)', example: 52 }
          }
        },
        IncomeItemMutationResponse: {
          type: 'object',
          description: 'Returned by POST /income and PUT /income/:incomeId. Includes ONLY the touched item plus recomputed totals — NOT the full parent budget.',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              required: ['item', 'totals'],
              properties: {
                item: { $ref: '#/components/schemas/IncomeItem' },
                totals: { $ref: '#/components/schemas/BudgetTotals' }
              }
            },
            message: { type: 'string', example: 'Income item added successfully' }
          }
        },
        ExpenseItemMutationResponse: {
          type: 'object',
          description: 'Returned by POST /expense and PUT /expense/:expenseId. Includes ONLY the touched item plus recomputed totals.',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              required: ['item', 'totals'],
              properties: {
                item: { $ref: '#/components/schemas/ExpenseItem' },
                totals: { $ref: '#/components/schemas/BudgetTotals' }
              }
            },
            message: { type: 'string', example: 'Expense item added successfully' }
          }
        },
        ItemRemovalResponse: {
          type: 'object',
          description: 'Returned by DELETE /income/:incomeId and DELETE /expense/:expenseId. The item no longer exists, so only the recomputed totals are returned.',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              required: ['totals'],
              properties: {
                totals: { $ref: '#/components/schemas/BudgetTotals' }
              }
            },
            message: { type: 'string', example: 'Income item deleted successfully' }
          }
        },
        PaginatedIncomeResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/IncomeItem' }
            },
            accounts: {
              type: 'array',
              description: 'User accounts (used to resolve accountId)',
              items: { type: 'object' }
            },
            pagination: { $ref: '#/components/schemas/Pagination' },
            message: { type: 'string', example: 'Income items retrieved successfully' }
          }
        },
        PaginatedExpenseResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/ExpenseItem' }
            },
            pagination: { $ref: '#/components/schemas/Pagination' },
            message: { type: 'string', example: 'Expense items retrieved successfully' }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Access token is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                response: {
                  message: 'Unauthorized',
                  error: 'No authentication token found'
                },
                status: 'error',
                statusCode: 401
              }
            }
          }
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                response: {
                  message: 'Not Found',
                  error: 'Transaction not found'
                },
                status: 'error',
                statusCode: 404
              }
            }
          }
        },
        BadRequestError: {
          description: 'Invalid request data',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                response: {
                  message: 'Bad Request',
                  error: 'Amount must be greater than 0'
                },
                status: 'error',
                statusCode: 400
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Transactions',
        description: 'Transaction management endpoints'
      },
      {
        name: 'Authentication',
        description: 'User authentication endpoints'
      },
      {
        name: 'Income',
        description: 'Income items nested under a budget (/api/budgets/{id}/income)'
      },
      {
        name: 'Expense',
        description: 'Expense items nested under a budget (/api/budgets/{id}/expense)'
      }
    ]
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts']
};

export const swaggerSpec = swaggerJsdoc(options);
