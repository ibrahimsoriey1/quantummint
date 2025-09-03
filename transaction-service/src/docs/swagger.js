const swaggerJsdoc = require('swagger-jsdoc');
const { version } = require('../../package.json');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'QuantumMint Transaction Service API',
      version,
      description: 'API documentation for the Transaction Service of QuantumMint',
      license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
      contact: { name: 'QuantumMint Support', url: 'https://quantummint.com', email: 'support@quantummint.com' }
    },
    servers: [
      { url: '/api', description: 'Transaction Service API' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      },
      schemas: {
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '64f0c2a1d4e9a1b2c3d4e5f6' },
            amount: { type: 'number', example: 100.5 },
            currency: { type: 'string', example: 'USD' },
            type: { type: 'string', example: 'credit' },
            status: { type: 'string', example: 'completed' },
            walletId: { type: 'string', example: 'wallet_123' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Balance: {
          type: 'object',
          properties: {
            walletId: { type: 'string', example: 'wallet_123' },
            available: { type: 'number', example: 250.75 },
            ledger: { type: 'number', example: 300.00 }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            status: { type: 'integer', example: 400 },
            message: { type: 'string', example: 'Error message' }
          }
        }
      }
    },
    security: [ { bearerAuth: [] } ],
    tags: [
      { name: 'Transactions', description: 'Transaction endpoints' },
      { name: 'Balances', description: 'Balance endpoints' }
    ]
  },
  apis: ['./src/routes/*.js', './src/docs/swagger/*.yaml']
};

const specs = swaggerJsdoc(options);
module.exports = { specs };



