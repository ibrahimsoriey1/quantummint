const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getClient: getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    // Check if token is blacklisted
    try {
      const redis = getRedisClient();
      const isBlacklisted = await redis.get(`blacklist:${token}`);
      if (isBlacklisted === '1') {
        return res.status(401).json({
          success: false,
          message: 'Token is invalid'
        });
      }
    } catch (redisError) {
      logger.error('Failed to check token blacklist:', redisError);
      // Continue with token verification if Redis fails
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    // Check if user exists and is active
    const user = await User.findById(decoded.userId).select('_id username email isActive role');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User account is deactivated'
      });
    }

    // Add user info to request
    req.user = {
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role
    };

    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    logger.error('Token authentication failed:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next(); // Continue without authentication
    }

    // Check if token is blacklisted
    try {
      const redis = getRedisClient();
      const isBlacklisted = await redis.get(`blacklist:${token}`);
      if (isBlacklisted === '1') {
        return next(); // Continue without authentication
      }
    } catch (redisError) {
      logger.error('Failed to check token blacklist:', redisError);
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'access') {
      return next(); // Continue without authentication
    }

    // Check if user exists and is active
    const user = await User.findById(decoded.userId).select('_id username email isActive role');
    if (user && user.isActive) {
      req.user = {
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role
      };
    }

    next();

  } catch (error) {
    // Continue without authentication on any error
    next();
  }
};

// Role-based access control middleware
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Require admin role
const requireAdmin = requireRole('admin');

// Require moderator or admin role
const requireModerator = requireRole('admin', 'moderator');

// Check if user owns the resource or is admin
const requireOwnership = (resourceIdField = 'id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const resourceId = req.params[resourceIdField] || req.body[resourceIdField];
    
    if (!resourceId) {
      return res.status(400).json({
        success: false,
        message: 'Resource ID is required'
      });
    }

    // Admin can access any resource
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user owns the resource
    if (req.user.userId === resourceId) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only access your own resources.'
    });
  };
};

// Rate limiting middleware for authentication endpoints
const authRateLimit = (req, res, next) => {
  const key = `auth:${req.ip}`;
  const limit = 5; // 5 attempts
  const windowMs = 15 * 60 * 1000; // 15 minutes

  // This is a simple in-memory rate limiter
  // In production, use Redis-based rate limiting
  if (!req.app.locals.authAttempts) {
    req.app.locals.authAttempts = new Map();
  }

  const attempts = req.app.locals.authAttempts.get(key) || { count: 0, resetTime: Date.now() + windowMs };

  if (Date.now() > attempts.resetTime) {
    attempts.count = 0;
    attempts.resetTime = Date.now() + windowMs;
  }

  attempts.count++;
  req.app.locals.authAttempts.set(key, attempts);

  if (attempts.count > limit) {
    return res.status(429).json({
      success: false,
      message: 'Too many authentication attempts. Please try again later.'
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole,
  requireAdmin,
  requireModerator,
  requireOwnership,
  authRateLimit
};
