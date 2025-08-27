/**
 * Rate Limiter for QuantumMint
 * Prevents abuse of API endpoints by limiting request frequency
 */

const Redis = require('ioredis');
const { RateLimiterRedis } = require('rate-limiter-flexible');

/**
 * Rate Limiter Service
 * Provides rate limiting functionality for API endpoints
 */
class RateLimiterService {
  /**
   * Initialize rate limiter service
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.redisClient = options.redisClient || new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      enableOfflineQueue: false,
    });

    this.limiterOptions = {
      storeClient: this.redisClient,
      keyPrefix: 'quantummint_ratelimit',
      points: options.points || 100, // Number of points
      duration: options.duration || 60, // Per second(s)
    };

    this.limiter = new RateLimiterRedis(this.limiterOptions);

    // Define tier-based rate limits
    this.tiers = {
      standard: {
        points: 100,
        duration: 60, // 100 requests per minute
      },
      premium: {
        points: 500,
        duration: 60, // 500 requests per minute
      },
      enterprise: {
        points: 1000,
        duration: 60, // 1000 requests per minute
      },
    };

    // Initialize tier limiters
    this.tierLimiters = {};
    Object.keys(this.tiers).forEach((tier) => {
      this.tierLimiters[tier] = new RateLimiterRedis({
        ...this.limiterOptions,
        keyPrefix: `quantummint_ratelimit_${tier}`,
        points: this.tiers[tier].points,
        duration: this.tiers[tier].duration,
      });
    });
  }

  /**
   * Consume points for a specific key
   * @param {String} key - Identifier for rate limiting (e.g., IP address, user ID)
   * @param {Number} points - Number of points to consume (default: 1)
   * @returns {Promise<Object>} Rate limiting result
   */
  async consume(key, points = 1) {
    try {
      const result = await this.limiter.consume(key, points);
      return {
        success: true,
        remainingPoints: result.remainingPoints,
        msBeforeNext: result.msBeforeNext,
        consumedPoints: result.consumedPoints,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      
      // RateLimiterRes was thrown
      return {
        success: false,
        remainingPoints: error.remainingPoints,
        msBeforeNext: error.msBeforeNext,
        consumedPoints: points,
      };
    }
  }

  /**
   * Consume points for a specific key based on user tier
   * @param {String} key - Identifier for rate limiting
   * @param {String} tier - User tier (standard, premium, enterprise)
   * @param {Number} points - Number of points to consume
   * @returns {Promise<Object>} Rate limiting result
   */
  async consumeByTier(key, tier = 'standard', points = 1) {
    if (!this.tierLimiters[tier]) {
      throw new Error(`Invalid tier: ${tier}`);
    }

    try {
      const result = await this.tierLimiters[tier].consume(key, points);
      return {
        success: true,
        tier,
        remainingPoints: result.remainingPoints,
        msBeforeNext: result.msBeforeNext,
        consumedPoints: result.consumedPoints,
        limit: this.tiers[tier].points,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      
      // RateLimiterRes was thrown
      return {
        success: false,
        tier,
        remainingPoints: error.remainingPoints,
        msBeforeNext: error.msBeforeNext,
        consumedPoints: points,
        limit: this.tiers[tier].points,
      };
    }
  }

  /**
   * Get rate limit headers
   * @param {Object} result - Result from consume or consumeByTier
   * @returns {Object} Headers object
   */
  getHeaders(result) {
    return {
      'X-RateLimit-Limit': result.limit || this.limiterOptions.points,
      'X-RateLimit-Remaining': result.remainingPoints,
      'X-RateLimit-Reset': Math.ceil(Date.now() + result.msBeforeNext),
    };
  }

  /**
   * Create Express middleware for rate limiting
   * @param {Object} options - Middleware options
   * @returns {Function} Express middleware
   */
  middleware(options = {}) {
    const keyGenerator = options.keyGenerator || ((req) => req.ip);
    const tierResolver = options.tierResolver || (() => 'standard');
    const pointsCalculator = options.pointsCalculator || (() => 1);
    const errorHandler = options.errorHandler || this.defaultErrorHandler;

    return async (req, res, next) => {
      try {
        const key = keyGenerator(req);
        const tier = tierResolver(req);
        const points = pointsCalculator(req);
        
        const result = await this.consumeByTier(key, tier, points);
        
        // Add headers
        const headers = this.getHeaders(result);
        Object.entries(headers).forEach(([name, value]) => {
          res.setHeader(name, value);
        });
        
        if (!result.success) {
          return errorHandler(req, res, result);
        }
        
        next();
      } catch (error) {
        console.error('QuantumMint Rate Limiter Error:', error);
        next(error);
      }
    };
  }

  /**
   * Default error handler for rate limiting
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @param {Object} result - Rate limiting result
   */
  defaultErrorHandler(req, res, result) {
    res.status(429).json({
      error: {
        code: 'rate_limit_exceeded',
        message: 'Too many requests, please try again later.',
        details: {
          retryAfter: Math.ceil(result.msBeforeNext / 1000),
          limit: result.limit,
        },
      },
    });
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }
}

module.exports = RateLimiterService;