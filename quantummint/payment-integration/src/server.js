const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { redisClient } = require('./config/redis.config');
const { initializeRabbitMQ, subscribeToEvents } = require('./utils/event.util');
const logger = require('./utils/logger.util');
const paymentRoutes = require('./routes/payment.routes');

// Environment variables
const {
  PORT = 3004,
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
app.use('/api/payments', paymentRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'payment-integration-service',
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
    subscribeToEvents('cash_out.initiated', handleCashOutInitiated);
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`Payment integration service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error(`Server initialization error: ${error.message}`);
    process.exit(1);
  }
}

// Event handlers
async function handleCashOutInitiated(data) {
  logger.info(`Cash out initiated event received: ${data.cashOutId}`);
  
  // No need to process here as the cash out is already initiated
  // This is just for monitoring and potential future use
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