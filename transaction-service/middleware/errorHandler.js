const logger = require('../utils/logger');

// Custom error class for application errors
class AppError extends Error {
  constructor(message, statusCode, errorCode = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Centralized error handling middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log the error
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = handleMongooseError(err);
    error = new AppError(message, 400, 'VALIDATION_ERROR');
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const message = handleDuplicateKeyError(err);
    error = new AppError(message, 400, 'DUPLICATE_KEY_ERROR');
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    const message = 'Invalid resource identifier';
    error = new AppError(message, 400, 'INVALID_ID_ERROR');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = new AppError(message, 401, 'JWT_INVALID');
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token has expired';
    error = new AppError(message, 401, 'JWT_EXPIRED');
  }

  // Redis errors
  if (err.code === 'ECONNREFUSED' && err.syscall === 'connect') {
    const message = 'Cache service unavailable';
    error = new AppError(message, 503, 'CACHE_UNAVAILABLE');
  }

  // RabbitMQ errors
  if (err.code === 'ECONNREFUSED' && err.message.includes('amqp')) {
    const message = 'Message queue service unavailable';
    error = new AppError(message, 503, 'QUEUE_UNAVAILABLE');
  }

  // Axios errors (HTTP client)
  if (err.isAxiosError) {
    const message = handleAxiosError(err);
    error = new AppError(message, err.response?.status || 500, 'EXTERNAL_API_ERROR');
  }

  // Rate limiting errors
  if (err.status === 429) {
    const message = 'Too many requests, please try again later';
    error = new AppError(message, 429, 'RATE_LIMIT_EXCEEDED');
  }

  // Default error
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';
  const errorCode = error.errorCode || 'INTERNAL_ERROR';

  // Don't leak error details in production
  const response = {
    error: message,
    code: errorCode,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: error.details
    })
  };

  res.status(statusCode).json(response);
};

// 404 handler for undefined routes
const notFound = (req, res, next) => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404,
    'ROUTE_NOT_FOUND'
  );
  next(error);
};

// Async handler wrapper to catch async errors
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Specific error handlers
const handleMongooseError = (err) => {
  const errors = Object.values(err.errors).map(val => val.message);
  return `Invalid input data: ${errors.join('. ')}`;
};

const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  return `Duplicate field value: ${field} = ${value}. Please use another value.`;
};

const handleAxiosError = (err) => {
  if (err.response) {
    // Server responded with error status
    return `External API error: ${err.response.status} - ${err.response.statusText}`;
  } else if (err.request) {
    // Request was made but no response received
    return 'External API request failed - no response received';
  } else {
    // Something else happened
    return 'External API request setup failed';
  }
};

// Transaction-specific error handlers
const handleTransactionError = (err) => {
  if (err.message.includes('Insufficient balance')) {
    return new AppError('Insufficient balance for transaction', 400, 'INSUFFICIENT_BALANCE');
  }
  
  if (err.message.includes('Daily limit exceeded')) {
    return new AppError('Daily transaction limit exceeded', 400, 'DAILY_LIMIT_EXCEEDED');
  }
  
  if (err.message.includes('Monthly limit exceeded')) {
    return new AppError('Monthly transaction limit exceeded', 400, 'MONTHLY_LIMIT_EXCEEDED');
  }
  
  if (err.message.includes('Amount below minimum')) {
    return new AppError('Transaction amount below minimum threshold', 400, 'AMOUNT_BELOW_MINIMUM');
  }
  
  if (err.message.includes('Amount above maximum')) {
    return new AppError('Transaction amount above maximum threshold', 400, 'AMOUNT_ABOVE_MAXIMUM');
  }
  
  return err;
};

const handleBalanceError = (err) => {
  if (err.message.includes('Insufficient available balance')) {
    return new AppError('Insufficient available balance', 400, 'INSUFFICIENT_AVAILABLE_BALANCE');
  }
  
  if (err.message.includes('Insufficient locked balance')) {
    return new AppError('Insufficient locked balance', 400, 'INSUFFICIENT_LOCKED_BALANCE');
  }
  
  return err;
};

const handleComplianceError = (err) => {
  if (err.message.includes('KYC required')) {
    return new AppError('KYC verification required for this transaction', 403, 'KYC_REQUIRED');
  }
  
  if (err.message.includes('Compliance check failed')) {
    return new AppError('Transaction failed compliance checks', 403, 'COMPLIANCE_CHECK_FAILED');
  }
  
  return err;
};

// Error response formatter
const formatErrorResponse = (error, req) => {
  const baseResponse = {
    error: error.message,
    code: error.errorCode || 'UNKNOWN_ERROR',
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method
  };

  // Add request ID if available
  if (req.id) {
    baseResponse.requestId = req.id;
  }

  // Add user context if available
  if (req.user) {
    baseResponse.userId = req.user.id;
  }

  // Add additional details in development
  if (process.env.NODE_ENV === 'development') {
    baseResponse.stack = error.stack;
    baseResponse.details = error.details;
  }

  return baseResponse;
};

// Global unhandled error handlers
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  process.exit(1);
});

module.exports = {
  AppError,
  errorHandler,
  notFound,
  asyncHandler,
  handleMongooseError,
  handleDuplicateKeyError,
  handleAxiosError,
  handleTransactionError,
  handleBalanceError,
  handleComplianceError,
  formatErrorResponse
};
