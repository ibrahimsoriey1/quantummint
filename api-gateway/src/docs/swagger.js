const swaggerJsdoc = require('swagger-jsdoc');
const { version } = require('../../package.json');

// Swagger definition
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'QuantumMint API',
      version,
      description: 'API documentation for QuantumMint digital money generator',
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      },
      contact: {
        name: 'QuantumMint Support',
        url: 'https://quantummint.com',
        email: 'support@quantummint.com'
      }
    },
    servers: [
      {
        url: '/api',
        description: 'API Gateway'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Auth',
        description: 'Authentication endpoints'
      },
      {
        name: 'Users',
        description: 'User management endpoints'
      },
      {
        name: 'Money Generation',
        description: 'Money generation endpoints'
      },
      {
        name: 'Wallets',
        description: 'Wallet management endpoints'
      },
      {
        name: 'Transactions',
        description: 'Transaction management endpoints'
      },
      {
        name: 'Payments',
        description: 'Payment integration endpoints'
      },
      {
        name: 'KYC',
        description: 'KYC verification endpoints'
      },
      {
        name: 'Documents',
        description: 'Document management endpoints'
      },
      {
        name: 'Admin',
        description: 'Admin endpoints'
      }
    ]
  },
  apis: ['./src/routes/*.js', './src/docs/swagger/*.yaml']
};

// Initialize swagger-jsdoc
const specs = swaggerJsdoc(options);

module.exports = { specs };