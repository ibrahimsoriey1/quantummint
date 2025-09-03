const jwt = require('jsonwebtoken');
const { ApiError } = require('./errorHandler');
const { logger } = require('../utils/logger');
require('dotenv').config();

/**
 * Middleware to authenticate users using JWT
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new ApiError(401, 'Authentication required. Please log in.'));
    }
    
    // Extract token
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return next(new ApiError(401, 'Authentication required. Please log in.'));
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Add user info to request object
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role
      };
      
      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return next(new ApiError(401, 'Invalid token. Please log in again.'));
      } else if (error.name === 'TokenExpiredError') {
        return next(new ApiError(401, 'Your token has expired. Please log in again.'));
      } else {
        logger.error(`Authentication error: ${error.message}`);
        return next(new ApiError(500, 'Authentication error. Please try again.'));
      }
    }
  } catch (error) {
    logger.error(`Authentication middleware error: ${error.message}`);
    return next(new ApiError(500, 'Internal server error'));
  }
};

module.exports = { authenticate };