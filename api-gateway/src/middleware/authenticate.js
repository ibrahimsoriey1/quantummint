const axios = require('axios');
const { ApiError } = require('./errorHandler');
const { logger } = require('../utils/logger');
const { services } = require('../config/services');
require('dotenv').config();

/**
 * Middleware to authenticate users using JWT
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new ApiError(401, 'Authentication required. Please log in.'));
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return next(new ApiError(401, 'Authentication required. Please log in.'));
    }

    try {
      const response = await axios.post(
        `${services.auth.url}/api/auth/verify-token`,
        { token },
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (!response.data.success) {
        return next(new ApiError(401, 'Invalid token. Please log in again.'));
      }

      req.user = response.data.user;
      next();
    } catch (error) {
      logger.error(`Token verification error: ${error.message}`);
      return next(new ApiError(401, 'Authentication failed. Please log in again.'));
    }
  } catch (error) {
    logger.error(`Authentication middleware error: ${error.message}`);
    return next(new ApiError(500, 'Internal server error'));
  }
};

/**
 * Middleware to verify token with auth service
 */
module.exports = { authenticate };