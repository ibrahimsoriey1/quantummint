const redis = require('redis');
const logger = require('../utils/logger');

let client = null;

const connectRedis = async () => {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    client = redis.createClient({
      url: redisUrl,
      password: process.env.REDIS_PASSWORD || undefined,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.error('Redis server refused connection');
          return new Error('Redis server refused connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          logger.error('Redis retry time exhausted');
          return new Error('Redis retry time exhausted');
        }
        if (options.attempt > 10) {
          logger.error('Redis max retry attempts reached');
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    // Handle Redis events
    client.on('connect', () => {
      logger.info('Redis client connected');
    });

    client.on('ready', () => {
      logger.info('Redis client ready');
    });

    client.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    client.on('end', () => {
      logger.warn('Redis client connection ended');
    });

    client.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });

    await client.connect();
    
    // Test connection
    await client.ping();
    logger.info('Redis connection test successful');

  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
};

// Get Redis client
const getClient = () => {
  if (!client) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return client;
};

// Close Redis connection
const closeRedis = async () => {
  if (client) {
    try {
      await client.quit();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
    }
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await closeRedis();
    process.exit(0);
  } catch (err) {
    logger.error('Error during Redis shutdown:', err);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  try {
    await closeRedis();
    process.exit(0);
  } catch (err) {
    logger.error('Error during Redis shutdown:', err);
    process.exit(1);
  }
});

module.exports = {
  connectRedis,
  getClient,
  closeRedis
};
