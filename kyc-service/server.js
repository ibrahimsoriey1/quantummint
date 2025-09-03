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

const kycRoutes = require('./routes/kyc');
const documentRoutes = require('./routes/document');
const verificationRoutes = require('./routes/verification');
const complianceRoutes = require('./routes/compliance');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3005;
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http, { cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:3006' } });
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Unauthorized'));
  // Optionally verify JWT here
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
    service: 'KYC Service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    features: {
      ocr: process.env.OCR_ENABLED === 'true' ? 'enabled' : 'disabled',
      faceRecognition: process.env.FACE_RECOGNITION_ENABLED === 'true' ? 'enabled' : 'disabled',
      documentVerification: process.env.DOCUMENT_VERIFICATION_ENABLED === 'true' ? 'enabled' : 'disabled',
      compliance: process.env.COMPLIANCE_CHECK_ENABLED === 'true' ? 'enabled' : 'disabled'
    }
  });
});

// API routes
app.use('/api/v1/kyc', kycRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/verification', verificationRoutes);
app.use('/api/v1/compliance', complianceRoutes);
app.use('/api/v1/admin', adminRoutes);

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
      logger.info(`KYC Service started on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`Features enabled: ${getEnabledFeatures()}`);
    });
  } catch (error) {
    logger.error('Failed to start KYC Service:', error);
    process.exit(1);
  }
};

// Helper function to get enabled features
function getEnabledFeatures() {
  const features = [];
  if (process.env.OCR_ENABLED === 'true') features.push('OCR');
  if (process.env.FACE_RECOGNITION_ENABLED === 'true') features.push('Face Recognition');
  if (process.env.DOCUMENT_VERIFICATION_ENABLED === 'true') features.push('Document Verification');
  if (process.env.COMPLIANCE_CHECK_ENABLED === 'true') features.push('Compliance');
  return features.length > 0 ? features.join(', ') : 'None';
}

startServer();
