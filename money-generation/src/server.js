const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const { connectDB } = require('./config/database');
const { logger } = require('./utils/logger');
const { requestIdMiddleware } = require('/usr/src/shared');
const { setupMessageQueue } = require('./config/messageQueue');
const { setupRedis, redisClient } = require('./config/redis');
const generationRoutes = require('./routes/generation.routes');
const walletRoutes = require('./routes/wallet.routes');
const { errorHandler } = require('./middleware/errorHandler');
require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(helmet()); // Security headers
app.use(requestIdMiddleware); // Correlation ID
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } })); // HTTP request logging
app.use(compression()); // Compress responses

// Routes
app.use('/api/generation', generationRoutes);
app.use('/api/wallets', walletRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', service: 'money-generation' });
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
  res.status(ready ? 200 : 503).json({ service: 'money-generation', ready, checks });
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
      logger.info(`Money generation service running on port ${PORT}`);
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