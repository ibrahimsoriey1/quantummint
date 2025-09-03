const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const csurf = require('csurf');
const swaggerUi = require('swagger-ui-express');
const { specs } = require('./docs/swagger');
const { connectDB } = require('./config/database');
const { logger } = require('./utils/logger');
const { requestIdMiddleware } = require('../../shared');
const { setupMessageQueue } = require('./config/messageQueue');
const { setupRedis, redisClient } = require('./config/redis');
const paymentRoutes = require('./routes/payment.routes');
const webhookRoutes = require('./routes/webhook.routes');
const providerRoutes = require('./routes/provider.routes');
const { errorHandler } = require('./middleware/errorHandler');
require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(helmet()); // Security headers
app.use(requestIdMiddleware); // Correlation ID
app.use(cors()); // Enable CORS

// Parse JSON bodies except for webhook routes
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/webhooks')) {
    // For webhook routes, use raw body for signature verification
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    // For all other routes, parse JSON body
    express.json()(req, res, next);
  }
});

app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(cookieParser());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } })); // HTTP request logging
app.use(compression()); // Compress responses
// CSRF protection (disabled for webhooks)
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/webhooks')) return next();
  return csurf({ cookie: true, ignoreMethods: ['GET', 'HEAD', 'OPTIONS'] })(req, res, next);
});

// Swagger docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Routes
app.use('/api/payments', paymentRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/providers', providerRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', service: 'payment-integration' });
});

// Readiness probe
app.get('/ready', async (req, res) => {
  const checks = { mongo: false, rabbitmq: false, redis: false };
  try {
    const mongoose = require('mongoose');
    checks.mongo = mongoose.connection && mongoose.connection.readyState === 1;
  } catch (_) {}
  try {
    checks.rabbitmq = true;
  } catch (_) {}
  try {
    if (redisClient) {
      await redisClient.ping();
      checks.redis = true;
    }
  } catch (_) {}
  const ready = checks.mongo && checks.rabbitmq && checks.redis;
  res.status(ready ? 200 : 503).json({ service: 'payment-integration', ready, checks });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Setup message queue
    await setupMessageQueue();
    
    // Setup Redis
    await setupRedis();
    
    // Start listening
    app.listen(PORT, () => {
      logger.info(`Payment integration service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  // Close server & exit process
  process.exit(1);
});

module.exports = app; // For testing purposes