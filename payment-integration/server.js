const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('express-async-errors');

const connectDB = require('./config/database');
const { connectRedis } = require('./config/redis');
const { connectRabbitMQ } = require('./config/rabbitmq');
const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const paymentRoutes = require('./routes/payment');
const webhookRoutes = require('./routes/webhook');
const settlementRoutes = require('./routes/settlement');
const providerRoutes = require('./routes/provider');
const exchangeRateRoutes = require('./routes/exchangeRate');
const fraudDetectionRoutes = require('./routes/fraudDetection');

const app = express();
const PORT = process.env.PORT || 3004;
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http, { cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:3006' } });
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Unauthorized'));
  // Optionally verify JWT here if shared secret available
  next();
});
const { setIO } = require('./utils/realtime');
setIO(io);

// Security middleware
app.use(helmet());
app.use(compression());
app.use(cors({ 
  origin: process.env.CORS_ORIGIN || 'http://localhost:3006', 
  credentials: true 
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS) / 1000 / 60)
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined', { 
  stream: { 
    write: message => logger.info(message.trim()) 
  } 
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Payment Integration Service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    providers: {
      stripe: process.env.STRIPE_SECRET_KEY ? 'configured' : 'not configured',
      orangeMoney: process.env.ORANGE_MONEY_MERCHANT_ID ? 'configured' : 'not configured',
      afriMoney: process.env.AFRIMONEY_MERCHANT_ID ? 'configured' : 'not configured'
    }
  });
});

// API routes
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/settlements', settlementRoutes);
app.use('/api/v1/providers', providerRoutes);
app.use('/api/v1/exchange-rates', exchangeRateRoutes);
app.use('/api/v1/fraud-detection', fraudDetectionRoutes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
const startServer = async () => {
  try {
    // Connect to databases and services
    await connectDB();
    await connectRedis();
    await connectRabbitMQ();
    
    // Start listening
    http.listen(PORT, () => {
      logger.info(`Payment Integration Service started on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`Supported providers: ${getSupportedProviders()}`);
    });
  } catch (error) {
    logger.error('Failed to start Payment Integration Service:', error);
    process.exit(1);
  }
};

// Helper function to get supported providers
function getSupportedProviders() {
  const providers = [];
  if (process.env.STRIPE_SECRET_KEY) providers.push('Stripe');
  if (process.env.ORANGE_MONEY_MERCHANT_ID) providers.push('Orange Money');
  if (process.env.AFRIMONEY_MERCHANT_ID) providers.push('AfriMoney');
  return providers.length > 0 ? providers.join(', ') : 'None configured';
}

startServer();
