const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const csurf = require('csurf');
const swaggerUi = require('swagger-ui-express');
const { specs } = require('./docs/swagger');
const compression = require('compression');
const { connectDB } = require('./config/database');
const { logger } = require('./utils/logger');
const { requestIdMiddleware } = require('../../shared');
const { setupMessageQueue } = require('./config/messageQueue');
const { setupRedis, redisClient } = require('./config/redis');
const transactionRoutes = require('./routes/transaction.routes');
const balanceRoutes = require('./routes/balance.routes');
const { errorHandler } = require('./middleware/errorHandler');
require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(helmet()); // Security headers
app.use(requestIdMiddleware); // Correlation ID
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(cookieParser());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } })); // HTTP request logging
app.use(compression()); // Compress responses
app.use(csurf({ cookie: true, ignoreMethods: ['GET', 'HEAD', 'OPTIONS'] }));

// Swagger docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Routes
app.use('/api/transactions', transactionRoutes);
app.use('/api/balances', balanceRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', service: 'transaction-service' });
});

// Readiness probe
app.get('/ready', async (req, res) => {
  const checks = { mongo: false, rabbitmq: false, redis: false };
  try {
    // Mongo readiness: rely on connection state from mongoose
    const mongoose = require('mongoose');
    checks.mongo = mongoose.connection && mongoose.connection.readyState === 1;
  } catch (_) {}
  try {
    // RabbitMQ: if setupMessageQueue completed earlier, assume available
    checks.rabbitmq = true;
  } catch (_) {}
  try {
    if (redisClient) {
      await redisClient.ping();
      checks.redis = true;
    }
  } catch (_) {}

  const ready = checks.mongo && checks.rabbitmq && checks.redis;
  res.status(ready ? 200 : 503).json({ service: 'transaction-service', ready, checks });
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
      logger.info(`Transaction service running on port ${PORT}`);
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