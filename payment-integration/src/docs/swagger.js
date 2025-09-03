const swaggerJsdoc = require('swagger-jsdoc');
const { version } = require('../../package.json');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'QuantumMint Payment Integration API',
      version,
      description: 'API documentation for the Payment Integration Service of QuantumMint'
    },
    servers: [ { url: '/api', description: 'Payment Integration Service API' } ],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        Payment: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            amount: { type: 'number' },
            currency: { type: 'string' },
            status: { type: 'string' },
            provider: { type: 'string' }
          }
        },
        Provider: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            status: { type: 'string' }
          }
        }
      }
    },
    security: [ { bearerAuth: [] } ],
    tags: [
      { name: 'Payments', description: 'Payment endpoints' },
      { name: 'Providers', description: 'Payment providers management' },
      { name: 'Webhooks', description: 'Webhook receivers' }
    ]
  },
  apis: ['./src/routes/*.js', './src/docs/swagger/*.yaml']
};

const specs = swaggerJsdoc(options);
module.exports = { specs };


