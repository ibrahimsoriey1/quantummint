const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const logger = require('./utils/logger');
const kycRoutes = require('./routes/kyc');
const documentRoutes = require('./routes/documents');
const verificationRoutes = require('./routes/verification');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.KYC_SERVICE_PORT || 3005;

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quantummint_kyc', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => logger.info('Connected to MongoDB'))
.catch(err => logger.error('MongoDB connection error:', err));

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'kyc-service',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/kyc', kycRoutes);
app.use('/documents', documentRoutes);
app.use('/verification', verificationRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested endpoint does not exist'
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`KYC Service running on port ${PORT}`);
});

module.exports = app;
