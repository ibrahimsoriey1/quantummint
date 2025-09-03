const logger = require('../utils/logger');

// Custom error class
class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Global error handler
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id,
    userAgent: req.get('User-Agent')
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new AppError(message, 400, 'VALIDATION_ERROR');
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate field value: ${field}. Please use another value.`;
    error = new AppError(message, 400, 'DUPLICATE_FIELD');
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    const message = `Invalid ${err.path}: ${err.value}`;
    error = new AppError(message, 400, 'INVALID_ID');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token. Please log in again.';
    error = new AppError(message, 401, 'INVALID_TOKEN');
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token has expired. Please log in again.';
    error = new AppError(message, 401, 'TOKEN_EXPIRED');
  }

  // Redis errors
  if (err.code === 'ECONNREFUSED' && err.syscall === 'connect') {
    const message = 'Service temporarily unavailable. Please try again later.';
    error = new AppError(message, 503, 'SERVICE_UNAVAILABLE');
  }

  // RabbitMQ errors
  if (err.code === 'ECONNREFUSED' && err.message.includes('amqp')) {
    const message = 'Message queue service unavailable. Please try again later.';
    error = new AppError(message, 503, 'QUEUE_UNAVAILABLE');
  }

  // Rate limiting errors
  if (err.status === 429) {
    const message = 'Too many requests. Please try again later.';
    error = new AppError(message, 429, 'RATE_LIMIT_EXCEEDED');
  }

  // Default error
  if (!error.statusCode) {
    error.statusCode = 500;
    error.message = 'Internal server error';
    error.code = 'INTERNAL_ERROR';
  }

  // Development error response
  if (process.env.NODE_ENV === 'development') {
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  } else {
    // Production error response
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    });
  }
};

// 404 handler
const notFound = (req, res, next) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404, 'ROUTE_NOT_FOUND');
  next(error);
};

// Async error wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Specific error handlers
const handleMongooseError = (err) => {
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return new AppError(`Validation Error: ${errors.join(', ')}`, 400, 'VALIDATION_ERROR');
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return new AppError(`Duplicate field: ${field}`, 400, 'DUPLICATE_FIELD');
  }
  return err;
};

const handleJWTError = (err) => {
  if (err.name === 'JsonWebTokenError') {
    return new AppError('Invalid token', 401, 'INVALID_TOKEN');
  }
  if (err.name === 'TokenExpiredError') {
    return new AppError('Token expired', 401, 'TOKEN_EXPIRED');
  }
  return err;
};

const handleRedisError = (err) => {
  if (err.code === 'ECONNREFUSED') {
    return new AppError('Cache service unavailable', 503, 'CACHE_UNAVAILABLE');
  }
  return err;
};

const handleRabbitMQError = (err) => {
  if (err.code === 'ECONNREFUSED') {
    return new AppError('Message queue unavailable', 503, 'QUEUE_UNAVAILABLE');
  }
  return err;
};

module.exports = {
  AppError,
  errorHandler,
  notFound,
  asyncHandler,
  handleMongooseError,
  handleJWTError,
  handleRedisError,
  handleRabbitMQError
};
