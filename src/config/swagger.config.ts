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
                email: 'support@example.com',
            },
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Development server',
            },
            {
                url: 'https://api.production.com',
                description: 'Production server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter your JWT token in the format: Bearer <token>',
                },
            },
            schemas: {
                ApiResponse: {
                    type: 'object',
                    properties: {
                        response: {
                            description: 'The actual data returned',
                        },
                        status: {
                            type: 'string',
                            enum: ['ok', 'error'],
                            description: 'Status of the response',
                        },
                        statusCode: {
                            type: 'number',
                            description: 'HTTP status code',
                        },
                        headers: {
                            type: 'object',
                            additionalProperties: {
                                type: 'string',
                            },
                        },
                    },
                },
                Transaction: {
                    type: 'object',
                    required: ['id', 'type', 'category', 'amount', 'description', 'date', 'userId'],
                    properties: {
                        id: {
                            type: 'string',
                            description: 'Unique identifier',
                            example: '507f1f77bcf86cd799439011',
                        },
                        type: {
                            type: 'string',
                            enum: ['income', 'expense', 'savings'],
                            description: 'Type of transaction',
                            example: 'expense',
                        },
                        category: {
                            type: 'string',
                            description: 'Category of the transaction',
                            example: 'Food',
                        },
                        amount: {
                            type: 'number',
                            format: 'float',
                            minimum: 0.01,
                            description: 'Amount in MXN',
                            example: 150.50,
                        },
                        description: {
                            type: 'string',
                            minLength: 1,
                            description: 'Description of the transaction',
                            example: 'Grocery shopping at supermarket',
                        },
                        date: {
                            type: 'string',
                            format: 'date',
                            description: 'Date of the transaction (ISO 8601)',
                            example: '2025-12-29',
                        },
                        userId: {
                            type: 'string',
                            description: 'ID of the user who owns this transaction',
                            example: '507f1f77bcf86cd799439011',
                        },
                    },
                },
                CreateTransactionRequest: {
                    type: 'object',
                    required: ['type', 'category', 'amount', 'description', 'date'],
                    properties: {
                        type: {
                            type: 'string',
                            enum: ['income', 'expense', 'savings'],
                            description: 'Type of transaction',
                            example: 'expense',
                        },
                        category: {
                            type: 'string',
                            minLength: 1,
                            description: 'Category of the transaction',
                            example: 'Food',
                        },
                        amount: {
                            type: 'number',
                            format: 'float',
                            minimum: 0.01,
                            description: 'Amount in MXN',
                            example: 150.50,
                        },
                        description: {
                            type: 'string',
                            minLength: 1,
                            description: 'Description of the transaction',
                            example: 'Grocery shopping at supermarket',
                        },
                        date: {
                            type: 'string',
                            format: 'date',
                            description: 'Date of the transaction (ISO 8601)',
                            example: '2025-12-29',
                        },
                    },
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
                                coins: { type: 'number', example: 50 },
                            },
                        },
                        expense: {
                            type: 'object',
                            properties: {
                                total: { type: 'number', example: 30000 },
                                count: { type: 'number', example: 15 },
                                experience: { type: 'number', example: 75 },
                                coins: { type: 'number', example: 30 },
                            },
                        },
                        savings: {
                            type: 'object',
                            properties: {
                                total: { type: 'number', example: 20000 },
                                count: { type: 'number', example: 3 },
                                experience: { type: 'number', example: 50 },
                                coins: { type: 'number', example: 20 },
                            },
                        },
                        netWorth: {
                            type: 'number',
                            description: 'Income - Expense',
                            example: 20000,
                        },
                        savingsProgress: {
                            type: 'number',
                            description: 'Percentage of savings goal achieved',
                            example: 65.5,
                        },
                    },
                },
                Error: {
                    type: 'object',
                    properties: {
                        response: {
                            type: 'object',
                            properties: {
                                message: {
                                    type: 'string',
                                    example: 'An error occurred',
                                },
                                error: {
                                    type: 'string',
                                    example: 'Detailed error message',
                                },
                            },
                        },
                        status: {
                            type: 'string',
                            enum: ['error'],
                        },
                        statusCode: {
                            type: 'number',
                            example: 400,
                        },
                    },
                },
            },
            responses: {
                UnauthorizedError: {
                    description: 'Access token is missing or invalid',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                            example: {
                                response: {
                                    message: 'Unauthorized',
                                    error: 'No authentication token found',
                                },
                                status: 'error',
                                statusCode: 401,
                            },
                        },
                    },
                },
                NotFoundError: {
                    description: 'Resource not found',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                            example: {
                                response: {
                                    message: 'Not Found',
                                    error: 'Transaction not found',
                                },
                                status: 'error',
                                statusCode: 404,
                            },
                        },
                    },
                },
                BadRequestError: {
                    description: 'Invalid request data',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                            example: {
                                response: {
                                    message: 'Bad Request',
                                    error: 'Amount must be greater than 0',
                                },
                                status: 'error',
                                statusCode: 400,
                            },
                        },
                    },
                },
            },
        },
        tags: [
            {
                name: 'Transactions',
                description: 'Transaction management endpoints',
            },
            {
                name: 'Authentication',
                description: 'User authentication endpoints',
            },
        ],
    },
    apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
