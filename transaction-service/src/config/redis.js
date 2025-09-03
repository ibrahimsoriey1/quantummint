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
    logger.warn('Transaction Service will function without Redis, but caching will be disabled');
    return false;
  }
};

// Handle Redis errors
redisClient.on('error', (error) => {
  logger.error(`Redis error: ${error.message}`);
});

// Cache middleware for Express routes
const cacheMiddleware = (duration) => {
  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Create a cache key from the request URL and user ID if available
    const userId = req.user ? req.user.id : 'anonymous';
    const cacheKey = `transaction:${userId}:${req.originalUrl || req.url}`;

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

// Function to clear cache by user ID and optional pattern
const clearUserCache = async (userId, pattern) => {
  try {
    const keys = await redisClient.keys(`transaction:${userId}:${pattern || '*'}`);
    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.info(`Cleared ${keys.length} cache entries for user ${userId} matching pattern: ${pattern || '*'}`);
    }
  } catch (error) {
    logger.error(`Clear cache error: ${error.message}`);
  }
};

// Function to clear all transaction cache
const clearAllCache = async () => {
  try {
    const keys = await redisClient.keys('transaction:*');
    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.info(`Cleared all transaction cache (${keys.length} entries)`);
    }
  } catch (error) {
    logger.error(`Clear all cache error: ${error.message}`);
  }
};

module.exports = { 
  redisClient, 
  setupRedis, 
  cacheMiddleware,
  clearUserCache,
  clearAllCache
};