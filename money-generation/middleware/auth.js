const jwt = require('jsonwebtoken');
const { getClient: getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Access token required',
        code: 'TOKEN_MISSING'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token is blacklisted
    const redisClient = getRedisClient();
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    
    if (isBlacklisted) {
      return res.status(401).json({
        error: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
      });
    }

    // Add user info to request
    req.user = {
      id: decoded.userId,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions || []
    };

    logger.info(`User authenticated: ${req.user.username}`, {
      userId: req.user.id,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'TOKEN_INVALID'
      });
    }

    logger.error('Authentication error:', error);
    return res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const redisClient = getRedisClient();
      const isBlacklisted = await redisClient.get(`blacklist:${token}`);
      
      if (!isBlacklisted) {
        req.user = {
          id: decoded.userId,
          username: decoded.username,
          email: decoded.email,
          role: decoded.role,
          permissions: decoded.permissions || []
        };
      }
    }

    next();
  } catch (error) {
    // Continue without authentication for optional routes
    next();
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(`Access denied for user ${req.user.username}`, {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        ip: req.ip
      });

      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

const requireAdmin = requireRole(['admin']);
const requireModerator = requireRole(['admin', 'moderator']);

const requireOwnership = (resourceField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Admins and moderators can access any resource
    if (['admin', 'moderator'].includes(req.user.role)) {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId = req.params[resourceField] || req.body[resourceField];
    
    if (resourceUserId && resourceUserId.toString() !== req.user.id.toString()) {
      logger.warn(`Resource access denied for user ${req.user.username}`, {
        userId: req.user.id,
        resourceUserId: resourceUserId,
        ip: req.ip
      });

      return res.status(403).json({
        error: 'Access denied to this resource',
        code: 'RESOURCE_ACCESS_DENIED'
      });
    }

    next();
  };
};

const authRateLimit = (req, res, next) => {
  // This would typically integrate with a rate limiting library
  // For now, we'll use a simple approach
  if (req.user) {
    // Log authenticated requests for monitoring
    logger.info(`Authenticated request from ${req.user.username}`, {
      userId: req.user.id,
      endpoint: req.originalUrl,
      method: req.method,
      ip: req.ip
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
