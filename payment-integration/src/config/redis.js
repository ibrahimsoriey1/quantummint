const { createClient } = require('redis');
const { logger } = require('../utils/logger');
require('dotenv').config();

// Redis configuration
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';

// Create Redis client with options
const redisClient = createClient({
  url: `redis://${REDIS_HOST}:${REDIS_PORT}`,
  password: REDIS_PASSWORD,
  socket: {
    reconnectStrategy: (retries) => {
      // Exponential backoff with max delay of 10 seconds
      return Math.min(retries * 100, 10000);
    }
  }
});

// Connect to Redis
const setupRedis = async () => {
  try {
    await redisClient.connect();
    logger.info(`Redis connected: ${REDIS_HOST}:${REDIS_PORT}`);
    return true;
  } catch (error) {
    logger.error(`Redis connection error: ${error.message}`);
    // Continue without Redis
    logger.warn('Payment Integration Service will function without Redis, but caching will be disabled');
    return false;
  }
};

// Handle Redis errors
redisClient.on('error', (error) => {
  logger.error(`Redis error: ${error.message}`);
});

// Cache provider configuration data
const cacheProviderConfig = async (providerId, config, ttl = 3600) => {
  try {
    const cacheKey = `payment:provider:${providerId}:config`;
    await redisClient.setEx(cacheKey, ttl, JSON.stringify(config));
    logger.debug(`Cached provider config for ${providerId}`);
    return true;
  } catch (error) {
    logger.error(`Cache provider config error: ${error.message}`);
    return false;
  }
};

// Get cached provider configuration
const getCachedProviderConfig = async (providerId) => {
  try {
    const cacheKey = `payment:provider:${providerId}:config`;
    const cachedConfig = await redisClient.get(cacheKey);
    if (cachedConfig) {
      logger.debug(`Cache hit for provider config ${providerId}`);
      return JSON.parse(cachedConfig);
    }
    return null;
  } catch (error) {
    logger.error(`Get cached provider config error: ${error.message}`);
    return null;
  }
};

// Cache payment method data for a user
const cacheUserPaymentMethods = async (userId, methods, ttl = 1800) => {
  try {
    const cacheKey = `payment:user:${userId}:methods`;
    await redisClient.setEx(cacheKey, ttl, JSON.stringify(methods));
    logger.debug(`Cached payment methods for user ${userId}`);
    return true;
  } catch (error) {
    logger.error(`Cache user payment methods error: ${error.message}`);
    return false;
  }
};

// Get cached payment methods for a user
const getCachedUserPaymentMethods = async (userId) => {
  try {
    const cacheKey = `payment:user:${userId}:methods`;
    const cachedMethods = await redisClient.get(cacheKey);
    if (cachedMethods) {
      logger.debug(`Cache hit for user payment methods ${userId}`);
      return JSON.parse(cachedMethods);
    }
    return null;
  } catch (error) {
    logger.error(`Get cached user payment methods error: ${error.message}`);
    return null;
  }
};

// Clear user payment methods cache
const clearUserPaymentMethodsCache = async (userId) => {
  try {
    const cacheKey = `payment:user:${userId}:methods`;
    await redisClient.del(cacheKey);
    logger.debug(`Cleared payment methods cache for user ${userId}`);
    return true;
  } catch (error) {
    logger.error(`Clear user payment methods cache error: ${error.message}`);
    return false;
  }
};

// Cache middleware for Express routes
const cacheMiddleware = (duration) => {
  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Create a cache key from the request URL and user ID if available
    const userId = req.user ? req.user.id : 'anonymous';
    const cacheKey = `payment:${userId}:${req.originalUrl || req.url}`;

    try {
      // Check if we have a cache hit
      const cachedResponse = await redisClient.get(cacheKey);
      
      if (cachedResponse) {
        // Return cached response
        const parsedResponse = JSON.parse(cachedResponse);
        logger.debug(`Cache hit for ${cacheKey}`);
        return res.status(200).json(parsedResponse);
      }

      // Store the original send function
      const originalSend = res.send;
      
      // Override the send function to cache the response
      res.send = function(body) {
        // Only cache successful responses
        if (res.statusCode === 200) {
          // Cache the response
          redisClient.setEx(cacheKey, duration, body)
            .catch(err => logger.error(`Redis cache error: ${err.message}`));
        }
        
        // Call the original send function
        originalSend.call(this, body);
      };
      
      next();
    } catch (error) {
      logger.error(`Cache middleware error: ${error.message}`);
      next();
    }
  };
};

module.exports = { 
  redisClient, 
  setupRedis, 
  cacheMiddleware,
  cacheProviderConfig,
  getCachedProviderConfig,
  cacheUserPaymentMethods,
  getCachedUserPaymentMethods,
  clearUserPaymentMethodsCache
};