const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const { verifyToken } = require('./middleware/auth.middleware');
const logger = require('./utils/logger.util');

// Load environment variables
require('dotenv').config();

// Create Express app
const app = express();

// Environment variables
const {
  PORT = 3000,
  NODE_ENV = 'development',
  AUTH_SERVICE_URL,
  MONEY_GENERATION_SERVICE_URL,
  TRANSACTION_SERVICE_URL,
  PAYMENT_INTEGRATION_SERVICE_URL
} = process.env;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests, please try again later.'
    }
  }
});

// Apply rate limiting to all routes
app.use(apiLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString()
  });
});

// Public routes
app.use('/api/auth', createProxyMiddleware({
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/auth': '/api/auth'
  }
}));

// Protected routes
app.use('/api/generate', verifyToken, createProxyMiddleware({
  target: MONEY_GENERATION_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/generate': '/api/generate'
  }
}));

app.use('/api/transactions', verifyToken, createProxyMiddleware({
  target: TRANSACTION_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/transactions': '/api/transactions'
  }
}));

app.use('/api/cashout', verifyToken, createProxyMiddleware({
  target: PAYMENT_INTEGRATION_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/cashout': '/api/payments/cash-out'
  }
}));

app.use('/api/wallets', verifyToken, createProxyMiddleware({
  target: TRANSACTION_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/wallets': '/api/wallets'
  }
}));

app.use('/api/users', verifyToken, createProxyMiddleware({
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/users': '/api/users'
  }
}));

// Admin routes
app.use('/api/admin', verifyToken, (req, res, next) => {
  // Check if user has admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this resource'
      }
    });
  }
  next();
}, createProxyMiddleware({
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/admin': '/api/admin'
  }
}));

// Webhook routes (public)
app.use('/api/webhooks/orange-money', createProxyMiddleware({
  target: PAYMENT_INTEGRATION_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/webhooks/orange-money': '/api/payments/webhook/orange_money'
  }
}));

app.use('/api/webhooks/afrimoney', createProxyMiddleware({
  target: PAYMENT_INTEGRATION_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/webhooks/afrimoney': '/api/payments/webhook/afrimoney'
  }
}));

app.use('/api/webhooks/stripe', createProxyMiddleware({
  target: PAYMENT_INTEGRATION_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/webhooks/stripe': '/api/payments/webhook/stripe'
  }
}));

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred'
    }
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});

module.exports = app;