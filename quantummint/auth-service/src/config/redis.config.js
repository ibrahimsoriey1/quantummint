const { createClient } = require('redis');
const logger = require('../utils/logger.util');

// Environment variables
const {
  REDIS_HOST = 'localhost',
  REDIS_PORT = 6379
} = process.env;

// Create Redis client
const redisClient = createClient({
  url: `redis://${REDIS_HOST}:${REDIS_PORT}`
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
    logger.info('Connected to Redis');
  } catch (error) {
    logger.error(`Redis connection error: ${error.message}`);
    process.exit(1);
  }
})();

// Handle Redis errors
redisClient.on('error', (error) => {
  logger.error(`Redis error: ${error.message}`);
});

module.exports = {
  redisClient
};