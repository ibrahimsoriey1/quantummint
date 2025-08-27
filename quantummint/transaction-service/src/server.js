const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { redisClient } = require('./config/redis.config');
const { initializeRabbitMQ, subscribeToEvents } = require('./utils/event.util');
const logger = require('./utils/logger.util');
const transactionRoutes = require('./routes/transaction.routes');
const walletRoutes = require('./routes/wallet.routes');

// Environment variables
const {
  PORT = 3003,
  MONGODB_URI,
  NODE_ENV = 'development'
} = process.env;

// Create Express app
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Routes
app.use('/api/transactions', transactionRoutes);
app.use('/api/wallets', walletRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'transaction-service',
    timestamp: new Date().toISOString()
  });
});

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

// Connect to MongoDB and start server
async function startServer() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB');
    
    // Initialize RabbitMQ
    await initializeRabbitMQ();
    
    // Subscribe to events
    subscribeToEvents('generation.completed', handleGenerationCompleted);
    subscribeToEvents('cash_out.initiated', handleCashOutInitiated);
    subscribeToEvents('cash_out.completed', handleCashOutCompleted);
    subscribeToEvents('cash_out.failed', handleCashOutFailed);
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`Transaction service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error(`Server initialization error: ${error.message}`);
    process.exit(1);
  }
}

// Event handlers
async function handleGenerationCompleted(data) {
  logger.info(`Generation completed event received: ${data.generationId}`);
  // Handle generation completed event
  // This is already handled by the money generation service
}

async function handleCashOutInitiated(data) {
  logger.info(`Cash out initiated event received: ${data.cashOutId}`);
  // The transaction is already created by the cash_out API endpoint
  // This handler is for monitoring and potential future use
}

async function handleCashOutCompleted(data) {
  logger.info(`Cash out completed event received: ${data.cashOutId}`);
  // Update transaction status if needed
  try {
    const { transactionId } = data;
    if (transactionId) {
      const transaction = await mongoose.model('Transaction').findById(transactionId);
      if (transaction && transaction.status !== 'completed') {
        transaction.status = 'completed';
        transaction.completedAt = new Date();
        await transaction.save();
        logger.info(`Transaction ${transactionId} marked as completed`);
      }
    }
  } catch (error) {
    logger.error(`Error handling cash_out.completed event: ${error.message}`);
  }
}

async function handleCashOutFailed(data) {
  logger.info(`Cash out failed event received: ${data.cashOutId}`);
  // Update transaction status if needed
  try {
    const { transactionId, failureReason } = data;
    if (transactionId) {
      const transaction = await mongoose.model('Transaction').findById(transactionId);
      if (transaction && transaction.status !== 'failed') {
        transaction.status = 'failed';
        transaction.failureReason = failureReason || 'Cash out failed';
        await transaction.save();
        logger.info(`Transaction ${transactionId} marked as failed`);
      }
    }
  } catch (error) {
    logger.error(`Error handling cash_out.failed event: ${error.message}`);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});

// Handle SIGTERM
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Close MongoDB connection
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
  
  // Close Redis connection
  await redisClient.quit();
  logger.info('Redis connection closed');
  
  process.exit(0);
});

// Start the server
startServer();