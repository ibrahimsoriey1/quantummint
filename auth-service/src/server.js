const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectDB } = require('./config/database');
const { logger } = require('./utils/logger');
const { requestIdMiddleware } = require('/usr/src/shared');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const twoFactorRoutes = require('./routes/twoFactor.routes');
const { errorHandler } = require('./middleware/errorHandler');
require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet()); // Security headers
app.use(requestIdMiddleware); // Correlation ID
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } })); // HTTP request logging

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/2fa', twoFactorRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', service: 'auth-service' });
});

// Readiness probe
app.get('/ready', async (req, res) => {
  const checks = { mongo: false };
  try {
    const mongoose = require('mongoose');
    checks.mongo = mongoose.connection && mongoose.connection.readyState === 1;
  } catch (_) {}
  const ready = checks.mongo;
  res.status(ready ? 200 : 503).json({ service: 'auth-service', ready, checks });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Start listening
    app.listen(PORT, () => {
      logger.info(`Auth service running on port ${PORT}`);
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