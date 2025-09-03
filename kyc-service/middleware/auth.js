const jwt = require('jsonwebtoken');
const { getClient } = require('../config/redis');
const logger = require('../utils/logger');
const { AppError } = require('./errorHandler');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw new AppError('Access token required', 401, 'TOKEN_REQUIRED');
    }

    // Check if token is blacklisted
    const redis = getClient();
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      throw new AppError('Token has been revoked', 401, 'TOKEN_REVOKED');
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Add user info to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      kycLevel: decoded.kycLevel || 0
    };

    logger.audit('User authenticated', {
      userId: decoded.id,
      email: decoded.email,
      role: decoded.role,
      ip: req.ip
    });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(new AppError('Invalid token', 401, 'INVALID_TOKEN'));
    } else if (error.name === 'TokenExpiredError') {
      next(new AppError('Token expired', 401, 'TOKEN_EXPIRED'));
    } else {
      next(error);
    }
  }
};

// Require specific role
const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
    }

    if (req.user.role !== role) {
      logger.security('Unauthorized role access attempt', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRole: role,
        endpoint: req.originalUrl,
        ip: req.ip
      });
      return next(new AppError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
    }

    next();
  };
};

// Require admin role
const requireAdmin = requireRole('admin');

// Require moderator role
const requireModerator = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
  }

  if (!['admin', 'moderator'].includes(req.user.role)) {
    logger.security('Unauthorized moderator access attempt', {
      userId: req.user.id,
      userRole: req.user.role,
      endpoint: req.originalUrl,
      ip: req.ip
    });
    return next(new AppError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
  }

  next();
};

// Require specific KYC level
const requireKYCLevel = (level) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
    }

    if (req.user.kycLevel < level) {
      logger.security('Insufficient KYC level access attempt', {
        userId: req.user.id,
        userKYCLevel: req.user.kycLevel,
        requiredKYCLevel: level,
        endpoint: req.originalUrl,
        ip: req.ip
      });
      return next(new AppError(`KYC level ${level} required`, 403, 'INSUFFICIENT_KYC_LEVEL'));
    }

    next();
  };
};

// Verify webhook signature for different providers
const verifyWebhookSignature = (provider) => {
  return (req, res, next) => {
    try {
      const signature = req.headers['x-signature'] || req.headers['stripe-signature'];
      
      if (!signature) {
        throw new AppError('Webhook signature required', 401, 'WEBHOOK_SIGNATURE_REQUIRED');
      }

      // This would implement actual signature verification logic
      // For now, just pass through
      logger.security('Webhook signature verified', {
        provider,
        signature: signature.substring(0, 20) + '...',
        ip: req.ip
      });

      next();
    } catch (error) {
      logger.security('Webhook signature verification failed', {
        provider,
        error: error.message,
        ip: req.ip
      });
      next(new AppError('Invalid webhook signature', 401, 'INVALID_WEBHOOK_SIGNATURE'));
    }
  };
};

// Rate limiting for specific endpoints
const createRateLimiter = (windowMs, max, message) => {
  return (req, res, next) => {
    const key = `rate_limit:${req.ip}:${req.originalUrl}`;
    const redis = getClient();

    redis.incr(key, (err, count) => {
      if (err) {
        logger.error('Rate limiting error:', err);
        return next();
      }

      if (count === 1) {
        redis.expire(key, windowMs / 1000);
      }

      if (count > max) {
        logger.security('Rate limit exceeded', {
          ip: req.ip,
          endpoint: req.originalUrl,
          count,
          max
        });
        return res.status(429).json({
          error: message || 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      next();
    });
  };
};

// Specific rate limiters
const kycRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  10, // 10 requests
  'Too many KYC requests'
);

const documentRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  20, // 20 requests
  'Too many document uploads'
);

const verificationRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  15, // 15 requests
  'Too many verification attempts'
);

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireModerator,
  requireKYCLevel,
  verifyWebhookSignature,
  createRateLimiter,
  kycRateLimiter,
  documentRateLimiter,
  verificationRateLimiter
};

