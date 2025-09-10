const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'QuantumMint API Gateway',
      version: '1.0.0',
      description: 'API Gateway for QuantumMint Digital Money Platform',
      contact: {
        name: 'NinjaTech AI',
        email: 'support@quantummint.com'
      }
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [
      {
        BearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.js', './src/server.js']
};

module.exports = swaggerOptions;
