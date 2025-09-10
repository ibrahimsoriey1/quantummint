const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
require('dotenv').config();

const authMiddleware = require('./middleware/auth');
const logger = require('./utils/logger');
const swaggerConfig = require('./config/swagger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Health check endpoint
const healthResponse = (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    services: {
      'auth-service': process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
      'money-generation': process.env.MONEY_GENERATION_SERVICE_URL || 'http://money-generation:3002',
      'transaction-service': process.env.TRANSACTION_SERVICE_URL || 'http://transaction-service:3003',
      'payment-integration': process.env.PAYMENT_INTEGRATION_SERVICE_URL || 'http://payment-integration:3004',
      'kyc-service': process.env.KYC_SERVICE_URL || 'http://kyc-service:3005'
    }
  });
};

app.get('/health', healthResponse);
app.post('/health', healthResponse);

// API Documentation
const specs = swaggerJsdoc(swaggerConfig);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Service Proxies
const serviceProxies = {
  '/api/auth': {
    target: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    changeOrigin: true,
    pathRewrite: { '^/api/auth': '' },
    onError: (err, req, res) => {
      logger.error('Auth service proxy error:', err);
      res.status(503).json({ error: 'Auth service unavailable' });
    }
  },
  '/api/money': {
    target: process.env.MONEY_GENERATION_SERVICE_URL || 'http://money-generation:3002',
    changeOrigin: true,
    pathRewrite: { '^/api/money': '' },
    onError: (err, req, res) => {
      logger.error('Money generation service proxy error:', err);
      res.status(503).json({ error: 'Money generation service unavailable' });
    }
  },
  '/api/transactions': {
    target: process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3003',
    changeOrigin: true,
    pathRewrite: { '^/api/transactions': '' },
    onError: (err, req, res) => {
      logger.error('Transaction service proxy error:', err);
      res.status(503).json({ error: 'Transaction service unavailable' });
    }
  },
  '/api/payments': {
    target: process.env.PAYMENT_INTEGRATION_SERVICE_URL || 'http://payment-integration:3004',
    changeOrigin: true,
    pathRewrite: { '^/api/payments': '' },
    onError: (err, req, res) => {
      logger.error('Payment integration service proxy error:', err);
      res.status(503).json({ error: 'Payment integration service unavailable' });
    }
  },
  '/api/kyc': {
    target: process.env.KYC_SERVICE_URL || 'http://localhost:3005',
    changeOrigin: true,
    pathRewrite: { '^/api/kyc': '' },
    onError: (err, req, res) => {
      logger.error('KYC service proxy error:', err);
      res.status(503).json({ error: 'KYC service unavailable' });
    }
  }
};

// Apply authentication middleware to protected routes
const protectedRoutes = ['/api/money', '/api/transactions', '/api/payments', '/api/kyc'];
protectedRoutes.forEach(route => {
  app.use(route, authMiddleware.verifyToken);
});

// Setup proxies
Object.entries(serviceProxies).forEach(([path, config]) => {
  app.use(path, createProxyMiddleware(config));
});

// Serve static files from frontend build
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../frontend/build')));
  
  // Catch all handler for React Router (only for non-API routes)
  app.get('*', (req, res) => {
    // Skip API routes, health, and api-docs - let them fall through to 404 handler
    if (req.path.startsWith('/api') || req.path.startsWith('/health') || req.path.startsWith('/api-docs')) {
      return res.status(404).json({
        success: false,
        error: 'Not found',
        message: 'The requested endpoint does not exist'
      });
    }
    
    res.sendFile(path.join(__dirname, '../../frontend/build', 'index.html'));
  });
} else {
  // 404 handler for non-production environments
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'Not found',
      message: 'The requested endpoint does not exist'
    });
  });
}

// JSON parsing error handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    logger.error('JSON parsing error:', err);
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON format',
      message: 'The request body contains invalid JSON'
    });
  }
  
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});


// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`API Gateway running on port ${PORT}`);
    logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
  });
}

module.exports = app;
