const { createClient } = require('redis');
const { logger } = require('../utils/logger');
require('dotenv').config();

// Redis configuration
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

// Create Redis client
const redisClient = createClient({
  url: `redis://${REDIS_HOST}:${REDIS_PORT}`
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
    logger.info(`Redis connected: ${REDIS_HOST}:${REDIS_PORT}`);
  } catch (error) {
    logger.error(`Redis connection error: ${error.message}`);
    process.exit(1);
  }
})();

// Handle Redis errors
redisClient.on('error', (error) => {
  logger.error(`Redis error: ${error.message}`);
});

module.exports = { redisClient };