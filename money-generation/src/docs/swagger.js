const swaggerJsdoc = require('swagger-jsdoc');
const { version } = require('../../package.json');

// Swagger definition
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'QuantumMint Money Generation Service API',
      version,
      description: 'API documentation for the Money Generation Service of QuantumMint digital money generator',
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
      contact: {
        name: 'QuantumMint Support',
        url: 'https://quantummint.com',
        email: 'support@quantummint.com',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'Money Generation Service API',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Wallet: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Wallet ID',
              example: '60d21b4667d0d8992e610c83',
            },
            userId: {
              type: 'string',
              description: 'User ID',
              example: '60d21b4667d0d8992e610c84',
            },
            balance: {
              type: 'number',
              description: 'Wallet balance',
              example: 5000,
            },
            currency: {
              type: 'string',
              description: 'Wallet currency',
              example: 'USD',
            },
            type: {
              type: 'string',
              enum: ['standard', 'premium', 'business'],
              description: 'Wallet type',
              example: 'standard',
            },
            status: {
              type: 'string',
              enum: ['active', 'suspended', 'closed'],
              description: 'Wallet status',
              example: 'active',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Wallet creation timestamp',
              example: '2023-01-01T00:00:00.000Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Wallet last update timestamp',
              example: '2023-01-01T00:00:00.000Z',
            },
          },
        },
        Generation: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Generation ID',
              example: '60d21b4667d0d8992e610c85',
            },
            userId: {
              type: 'string',
              description: 'User ID',
              example: '60d21b4667d0d8992e610c84',
            },
            walletId: {
              type: 'string',
              description: 'Wallet ID',
              example: '60d21b4667d0d8992e610c83',
            },
            amount: {
              type: 'number',
              description: 'Generation amount',
              example: 1000,
            },
            fee: {
              type: 'number',
              description: 'Generation fee',
              example: 0,
            },
            netAmount: {
              type: 'number',
              description: 'Net amount after fee',
              example: 1000,
            },
            method: {
              type: 'string',
              enum: ['standard', 'express', 'premium'],
              description: 'Generation method',
              example: 'standard',
            },
            status: {
              type: 'string',
              enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
              description: 'Generation status',
              example: 'completed',
            },
            purpose: {
              type: 'string',
              description: 'Generation purpose',
              example: 'Personal expenses',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Generation creation timestamp',
              example: '2023-01-01T00:00:00.000Z',
            },
            completedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Generation completion timestamp',
              example: '2023-01-02T00:00:00.000Z',
            },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Transaction ID',
              example: '60d21b4667d0d8992e610c86',
            },
            userId: {
              type: 'string',
              description: 'User ID',
              example: '60d21b4667d0d8992e610c84',
            },
            type: {
              type: 'string',
              enum: ['deposit', 'withdrawal', 'transfer', 'generation'],
              description: 'Transaction type',
              example: 'transfer',
            },
            amount: {
              type: 'number',
              description: 'Transaction amount',
              example: 500,
            },
            status: {
              type: 'string',
              enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
              description: 'Transaction status',
              example: 'completed',
            },
            recipientId: {
              type: 'string',
              description: 'Recipient user ID (for transfers)',
              example: '60d21b4667d0d8992e610c87',
            },
            note: {
              type: 'string',
              description: 'Transaction note',
              example: 'Payment for services',
            },
            paymentMethodId: {
              type: 'string',
              description: 'Payment method ID (for deposits/withdrawals)',
              example: '60d21b4667d0d8992e610c88',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Transaction creation timestamp',
              example: '2023-01-01T00:00:00.000Z',
            },
            completedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Transaction completion timestamp',
              example: '2023-01-01T00:00:00.000Z',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            status: {
              type: 'integer',
              example: 400,
            },
            message: {
              type: 'string',
              example: 'Error message',
            },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  value: {
                    type: 'string',
                    example: '-100',
                  },
                  msg: {
                    type: 'string',
                    example: 'Amount must be a positive number',
                  },
                  param: {
                    type: 'string',
                    example: 'amount',
                  },
                  location: {
                    type: 'string',
                    example: 'body',
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication information is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                status: 401,
                message: 'Authentication required. Please log in.',
              },
            },
          },
        },
        ForbiddenError: {
          description: 'User does not have permission to access this resource',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                status: 403,
                message: 'You do not have permission to access this resource',
              },
            },
          },
        },
        NotFoundError: {
          description: 'The requested resource was not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                status: 404,
                message: 'Resource not found',
              },
            },
          },
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ValidationError',
              },
            },
          },
        },
        ServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                status: 500,
                message: 'Internal server error',
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Generation',
        description: 'Money generation endpoints',
      },
      {
        name: 'Wallet',
        description: 'Wallet management endpoints',
      },
    ],
  },
  apis: ['./src/routes/*.js', './src/docs/swagger/*.yaml'],
};

// Initialize swagger-jsdoc
const specs = swaggerJsdoc(options);

module.exports = { specs };