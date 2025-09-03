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
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new AppError(message, 400, 'VALIDATION_ERROR');
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field} already exists`;
    error = new AppError(message, 400, 'DUPLICATE_KEY_ERROR');
  }

  // Mongoose cast error
  if (err.name === 'CastError') {
    const message = `Invalid ${err.path}: ${err.value}`;
    error = new AppError(message, 400, 'CAST_ERROR');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = new AppError(message, 401, 'INVALID_TOKEN');
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = new AppError(message, 401, 'TOKEN_EXPIRED');
  }

  // Redis errors
  if (err.code === 'ECONNREFUSED' && err.syscall === 'connect') {
    const message = 'Cache service unavailable';
    error = new AppError(message, 503, 'CACHE_SERVICE_UNAVAILABLE');
  }

  // RabbitMQ errors
  if (err.code === 'ECONNREFUSED' && err.message.includes('amqp')) {
    const message = 'Message queue service unavailable';
    error = new AppError(message, 503, 'QUEUE_SERVICE_UNAVAILABLE');
  }

  // Axios errors (HTTP client)
  if (err.isAxiosError) {
    if (err.response) {
      const message = `External service error: ${err.response.status}`;
      error = new AppError(message, err.response.status, 'EXTERNAL_SERVICE_ERROR');
    } else if (err.request) {
      const message = 'External service timeout';
      error = new AppError(message, 504, 'EXTERNAL_SERVICE_TIMEOUT');
    } else {
      const message = 'External service error';
      error = new AppError(message, 502, 'EXTERNAL_SERVICE_ERROR');
    }
  }

  // Rate limiting errors
  if (err.status === 429) {
    const message = 'Too many requests';
    error = new AppError(message, 429, 'RATE_LIMIT_EXCEEDED');
  }

  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File too large';
    error = new AppError(message, 400, 'FILE_TOO_LARGE');
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    const message = 'Too many files';
    error = new AppError(message, 400, 'TOO_MANY_FILES');
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Unexpected file field';
    error = new AppError(message, 400, 'UNEXPECTED_FILE_FIELD');
  }

  // OCR and document processing errors
  if (err.code === 'OCR_PROCESSING_FAILED') {
    const message = 'Document text extraction failed';
    error = new AppError(message, 422, 'OCR_PROCESSING_FAILED');
  }

  if (err.code === 'FACE_RECOGNITION_FAILED') {
    const message = 'Face recognition processing failed';
    error = new AppError(message, 422, 'FACE_RECOGNITION_FAILED');
  }

  if (err.code === 'DOCUMENT_VERIFICATION_FAILED') {
    const message = 'Document verification failed';
    error = new AppError(message, 422, 'DOCUMENT_VERIFICATION_FAILED');
  }

  // Compliance and verification errors
  if (err.code === 'COMPLIANCE_CHECK_FAILED') {
    const message = 'Compliance check failed';
    error = new AppError(message, 422, 'COMPLIANCE_CHECK_FAILED');
  }

  if (err.code === 'VERIFICATION_TIMEOUT') {
    const message = 'Verification process timed out';
    error = new AppError(message, 408, 'VERIFICATION_TIMEOUT');
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
const notFound = (req, res) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404, 'ROUTE_NOT_FOUND');
  res.status(404).json({
    error: error.message,
    code: error.errorCode
  });
};

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  notFound,
  asyncHandler,
  AppError
};
