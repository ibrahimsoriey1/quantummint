const Redis = require('ioredis');
const logger = require('../utils/logger.util');

// Create Redis client
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || '',
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

// Handle Redis connection events
redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

redisClient.on('error', (error) => {
  logger.error(`Redis connection error: ${error.message}`);
});

redisClient.on('close', () => {
  logger.warn('Redis connection closed');
});

module.exports = {
  redisClient
};