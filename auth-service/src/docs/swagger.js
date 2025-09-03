const swaggerJsdoc = require('swagger-jsdoc');
const { version } = require('../../package.json');

// Swagger definition
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'QuantumMint Authentication Service API',
      version,
      description: 'API documentation for the Authentication Service of QuantumMint digital money generator',
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
        description: 'Authentication Service API',
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
        User: {
          type: 'object',
          required: ['firstName', 'lastName', 'email', 'password'],
          properties: {
            id: {
              type: 'string',
              description: 'User ID',
              example: '60d21b4667d0d8992e610c85',
            },
            firstName: {
              type: 'string',
              description: 'User first name',
              example: 'John',
            },
            lastName: {
              type: 'string',
              description: 'User last name',
              example: 'Doe',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'john.doe@example.com',
            },
            password: {
              type: 'string',
              format: 'password',
              description: 'User password',
              example: 'Password123!',
            },
            phoneNumber: {
              type: 'string',
              description: 'User phone number',
              example: '+1234567890',
            },
            dateOfBirth: {
              type: 'string',
              format: 'date',
              description: 'User date of birth',
              example: '1990-01-01',
            },
            role: {
              type: 'string',
              enum: ['user', 'admin', 'super_admin'],
              description: 'User role',
              example: 'user',
            },
            isVerified: {
              type: 'boolean',
              description: 'Whether the user email is verified',
              example: true,
            },
            twoFactorEnabled: {
              type: 'boolean',
              description: 'Whether two-factor authentication is enabled',
              example: false,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'User creation timestamp',
              example: '2023-01-01T00:00:00.000Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'User last update timestamp',
              example: '2023-01-01T00:00:00.000Z',
            },
          },
        },
        UserResponse: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'User ID',
              example: '60d21b4667d0d8992e610c85',
            },
            firstName: {
              type: 'string',
              description: 'User first name',
              example: 'John',
            },
            lastName: {
              type: 'string',
              description: 'User last name',
              example: 'Doe',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'john.doe@example.com',
            },
            phoneNumber: {
              type: 'string',
              description: 'User phone number',
              example: '+1234567890',
            },
            role: {
              type: 'string',
              enum: ['user', 'admin', 'super_admin'],
              description: 'User role',
              example: 'user',
            },
            twoFactorEnabled: {
              type: 'boolean',
              description: 'Whether two-factor authentication is enabled',
              example: false,
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
                    example: 'invalid-email',
                  },
                  msg: {
                    type: 'string',
                    example: 'Invalid email address',
                  },
                  param: {
                    type: 'string',
                    example: 'email',
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
        name: 'Auth',
        description: 'Authentication endpoints',
      },
      {
        name: 'Users',
        description: 'User management endpoints',
      },
      {
        name: 'Two-Factor Authentication',
        description: 'Two-factor authentication endpoints',
      },
    ],
  },
  apis: ['./src/routes/*.js', './src/docs/swagger/*.yaml'],
};

// Initialize swagger-jsdoc
const specs = swaggerJsdoc(options);

module.exports = { specs };