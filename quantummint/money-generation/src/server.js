const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const logger = require('../../shared/utils/logger');
const generationRoutes = require('./routes/generation');
const walletRoutes = require('./routes/wallet');
const { errorHandler } = require('./middleware/errorHandler');
const { authenticate } = require('./middleware/auth');

const app = express();
const PORT = process.env.MONEY_GENERATION_PORT || 3002;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3006',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(logger.requestMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Money generation service is healthy',
    timestamp: new Date().toISOString(),
    service: 'money-generation',
    version: '1.0.0'
  });
});

// API routes
app.use('/api/generation', generationRoutes);
app.use('/api/wallet', walletRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Error handling middleware
app.use(logger.errorMiddleware);
app.use(errorHandler);

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quantummint_money', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  logger.info('Connected to MongoDB', { service: 'money-generation' });
})
.catch((error) => {
  logger.error('MongoDB connection error', { error: error.message, service: 'money-generation' });
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully', { service: 'money-generation' });
  mongoose.connection.close(() => {
    logger.info('MongoDB connection closed', { service: 'money-generation' });
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully', { service: 'money-generation' });
  mongoose.connection.close(() => {
    logger.info('MongoDB connection closed', { service: 'money-generation' });
    process.exit(0);
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Money generation service running on port ${PORT}`, { service: 'money-generation' });
});

module.exports = app;
