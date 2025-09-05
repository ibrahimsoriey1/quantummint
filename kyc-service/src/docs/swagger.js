const swaggerJsdoc = require('swagger-jsdoc');
const { version } = require('../../package.json');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'QuantumMint KYC Service API',
      version,
      description: 'API documentation for the KYC Service of QuantumMint'
    },
    servers: [ { url: '/api', description: 'KYC Service API' } ],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        KYCProfile: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string' } } },
        Document: { type: 'object', properties: { id: { type: 'string' }, type: { type: 'string' }, status: { type: 'string' } } },
        Verification: { type: 'object', properties: { id: { type: 'string' }, result: { type: 'string' } } }
      }
    },
    security: [ { bearerAuth: [] } ],
    tags: [
      { name: 'KYC', description: 'KYC profile endpoints' },
      { name: 'Documents', description: 'Document upload and management' },
      { name: 'Verifications', description: 'Verification endpoints' }
    ]
  },
  apis: ['./src/routes/*.js', './src/docs/swagger/*.yaml']
};

const specs = swaggerJsdoc(options);
module.exports = { specs };

















