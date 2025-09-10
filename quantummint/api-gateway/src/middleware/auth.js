const jwt = require('jsonwebtoken');
const axios = require('axios');
const logger = require('../utils/logger');

const verifyToken = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'Access denied. No token provided.' 
      });
    }

    // Verify token with auth service
    try {
      const response = await axios.post(`${process.env.AUTH_SERVICE_URL}/verify-token`, {
        token
      });

      if (response.data.valid) {
        req.user = response.data.user;
        next();
      } else {
        return res.status(401).json({ 
          success: false,
          error: 'Invalid token' 
        });
      }
    } catch (error) {
      logger.error('Token verification failed:', error.message);
      return res.status(401).json({ 
        success: false,
        error: 'Token verification failed' 
      });
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false,
        error: 'Insufficient permissions' 
      });
    }

    next();
  };
};

module.exports = {
  verifyToken,
  requireRole
};
