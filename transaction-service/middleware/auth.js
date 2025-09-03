const jwt = require('jsonwebtoken');
const { getClient: getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

// Verify JWT token and attach user to request
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access token required',
        code: 'TOKEN_MISSING'
      });
    }

    // Check if token is blacklisted in Redis
    const redisClient = getRedisClient();
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    
    if (isBlacklisted) {
      return res.status(401).json({
        error: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token is expired
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return res.status(401).json({
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    // Attach user information to request
    req.user = {
      id: decoded.userId,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
      kycLevel: decoded.kycLevel,
      isVerified: decoded.isVerified
    };

    logger.info('User authenticated', {
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role
    });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'TOKEN_INVALID'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    } else {
      logger.error('Authentication error:', error);
      return res.status(500).json({
        error: 'Authentication failed',
        code: 'AUTH_ERROR'
      });
    }
  }
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const redisClient = getRedisClient();
      const isBlacklisted = await redisClient.get(`blacklist:${token}`);
      
      if (!isBlacklisted) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          if (decoded.exp && Date.now() < decoded.exp * 1000) {
            req.user = {
              id: decoded.userId,
              username: decoded.username,
              email: decoded.email,
              role: decoded.role,
              kycLevel: decoded.kycLevel,
              isVerified: decoded.isVerified
            };
          }
        } catch (error) {
          // Token is invalid, but we don't fail the request
          logger.debug('Invalid token in optional auth:', error.message);
        }
      }
    }
    
    next();
  } catch (error) {
    logger.error('Optional authentication error:', error);
    next(); // Continue without authentication
  }
};

// Role-based access control
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Insufficient role access', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        endpoint: req.originalUrl
      });

      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: roles,
        userRole: req.user.role
      });
    }

    next();
  };
};

// Admin role requirement
const requireAdmin = requireRole(['admin']);

// Moderator or admin role requirement
const requireModerator = requireRole(['admin', 'moderator']);

// Resource ownership check
const requireOwnership = (resourceField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Admins and moderators can access all resources
    if (['admin', 'moderator'].includes(req.user.role)) {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId = req.params[resourceField] || req.body[resourceField] || req.query[resourceField];
    
    if (!resourceUserId) {
      return res.status(400).json({
        error: 'Resource identifier required',
        code: 'RESOURCE_ID_MISSING'
      });
    }

    if (resourceUserId !== req.user.id) {
      logger.warn('Unauthorized resource access attempt', {
        userId: req.user.id,
        resourceUserId,
        endpoint: req.originalUrl,
        method: req.method
      });

      return res.status(403).json({
        error: 'Access denied to this resource',
        code: 'RESOURCE_ACCESS_DENIED'
      });
    }

    next();
  };
};

// Rate limiting for authentication endpoints
const authRateLimit = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const key = `auth_rate_limit:${clientIP}`;
  
  // This is a basic rate limit - in production, use Redis-based rate limiting
  const maxAttempts = 5;
  const windowMs = 15 * 60 * 1000; // 15 minutes
  
  // For now, we'll let the main rate limiter handle this
  // In a full implementation, you'd check Redis for attempt counts
  next();
};

// KYC level requirement
const requireKYCLevel = (minLevel) => {
  const kycLevels = {
    'basic': 1,
    'verified': 2,
    'enhanced': 3
  };

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userLevel = kycLevels[req.user.kycLevel] || 0;
    const requiredLevel = kycLevels[minLevel] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        error: `KYC level ${minLevel} required`,
        code: 'KYC_LEVEL_INSUFFICIENT',
        currentLevel: req.user.kycLevel,
        requiredLevel: minLevel
      });
    }

    next();
  };
};

// Verification status requirement
const requireVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  if (!req.user.isVerified) {
    return res.status(403).json({
      error: 'Account verification required',
      code: 'ACCOUNT_UNVERIFIED'
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
  authRateLimit,
  requireKYCLevel,
  requireVerification
};
