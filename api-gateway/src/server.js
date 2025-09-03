const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const csurf = require('csurf');
const swaggerUi = require('swagger-ui-express');
const { logger } = require('./utils/logger');
const { setupRedis } = require('./config/redis');
const { requestIdMiddleware } = require('../../shared');
const { specs } = require('./docs/swagger');
const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');
const { ipRestrictionMiddleware } = require('./middleware/ipRestriction');
const fraudDetectionMiddleware = require('./middleware/fraudDetection');
const securityHeadersMiddleware = require('./middleware/securityHeaders');
require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Setup Redis
setupRedis();

// Configure CORS
const corsOptions = {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

// Configure rate limiter
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again later'
});

// Middleware
app.use(helmet()); // Security headers
app.use(requestIdMiddleware); // Correlation ID
app.use(cors(corsOptions)); // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(cookieParser()); // Parse cookies for CSRF token storage
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } })); // HTTP request logging
app.use(compression()); // Compress responses
app.use(limiter); // Rate limiting

// CSRF protection for state-changing routes (skip for GET, HEAD, OPTIONS)
app.use(
  csurf({ cookie: true, ignoreMethods: ['GET', 'HEAD', 'OPTIONS'] })
);

// Provide CSRF token for clients
app.get('/csrf-token', (req, res) => {
  return res.status(200).json({ csrfToken: req.csrfToken() });
});

// Advanced security middleware
app.use(securityHeadersMiddleware); // Additional security headers
app.use(ipRestrictionMiddleware); // IP-based restrictions
app.use(fraudDetectionMiddleware); // Fraud detection

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, { explorer: true }));

// Routes
app.use('/api', routes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', service: 'api-gateway' });
});

// Readiness probe: check Redis connectivity minimally
app.get('/ready', async (req, res) => {
  const checks = { redis: false };
  try {
    const { redisClient } = require('./config/redis');
    if (redisClient) {
      await redisClient.ping();
      checks.redis = true;
    }
  } catch (_) {}
  const ready = checks.redis;
  res.status(ready ? 200 : 503).json({ service: 'api-gateway', ready, checks });
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  // Keep the process running
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  // Keep the process running
});

module.exports = app; // For testing purposes