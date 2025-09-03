const { logger } = require('../utils/logger');
const { redisClient } = require('../config/redis');
const { ApiError } = require('./errorHandler');
require('dotenv').config();

/**
 * IP restriction middleware
 * Implements IP whitelisting, blacklisting, and rate limiting by IP
 */
class IpRestriction {
  constructor() {
    // Load IP whitelist and blacklist from environment variables
    this.ipWhitelist = process.env.IP_WHITELIST ? process.env.IP_WHITELIST.split(',') : [];
    this.ipBlacklist = process.env.IP_BLACKLIST ? process.env.IP_BLACKLIST.split(',') : [];
    
    // Rate limiting configuration
    this.rateLimit = {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per minute
      blockDuration: parseInt(process.env.RATE_LIMIT_BLOCK_DURATION) || 300 // 5 minutes block
    };
    
    // Geo-restriction configuration
    this.restrictedCountries = process.env.RESTRICTED_COUNTRIES ? process.env.RESTRICTED_COUNTRIES.split(',') : [];
    
    logger.info(`IP restriction middleware initialized with whitelist: ${this.ipWhitelist.length} IPs, blacklist: ${this.ipBlacklist.length} IPs`);
    logger.info(`Rate limiting: ${this.rateLimit.maxRequests} requests per ${this.rateLimit.windowMs / 1000} seconds`);
    logger.info(`Geo-restriction: ${this.restrictedCountries.length} countries restricted`);
  }

  /**
   * Check if IP is whitelisted
   * @param {String} ip - IP address
   * @returns {Boolean} - True if IP is whitelisted
   */
  isWhitelisted(ip) {
    return this.ipWhitelist.includes(ip) || this.ipWhitelist.includes('*');
  }

  /**
   * Check if IP is blacklisted
   * @param {String} ip - IP address
   * @returns {Boolean} - True if IP is blacklisted
   */
  isBlacklisted(ip) {
    return this.ipBlacklist.includes(ip);
  }

  /**
   * Get country code from IP
   * @param {String} ip - IP address
   * @returns {Promise<String>} - Country code
   */
  async getCountryFromIp(ip) {
    try {
      // Check if country is cached in Redis
      const cachedCountry = await redisClient.get(`ip:country:${ip}`);
      
      if (cachedCountry) {
        return cachedCountry;
      }
      
      // Use IP geolocation service
      // This is a placeholder - in a real implementation, you would use a geolocation service
      // like MaxMind GeoIP, ipapi.co, or ip-api.com
      const countryCode = 'US'; // Default to US for demo purposes
      
      // Cache country code for 24 hours
      await redisClient.setEx(`ip:country:${ip}`, 86400, countryCode);
      
      return countryCode;
    } catch (error) {
      logger.error(`Failed to get country from IP: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if country is restricted
   * @param {String} countryCode - Country code
   * @returns {Boolean} - True if country is restricted
   */
  isCountryRestricted(countryCode) {
    return this.restrictedCountries.includes(countryCode);
  }

  /**
   * Check if IP is rate limited
   * @param {String} ip - IP address
   * @returns {Promise<Boolean>} - True if IP is rate limited
   */
  async isRateLimited(ip) {
    try {
      // Check if IP is blocked
      const isBlocked = await redisClient.get(`ip:blocked:${ip}`);
      
      if (isBlocked) {
        return true;
      }
      
      // Get current request count
      const requestCount = await redisClient.get(`ip:requests:${ip}`);
      
      if (!requestCount) {
        // First request in the window
        await redisClient.setEx(`ip:requests:${ip}`, Math.floor(this.rateLimit.windowMs / 1000), '1');
        return false;
      }
      
      // Increment request count
      const newCount = parseInt(requestCount) + 1;
      
      // Check if rate limit exceeded
      if (newCount > this.rateLimit.maxRequests) {
        // Block IP for the specified duration
        await redisClient.setEx(`ip:blocked:${ip}`, this.rateLimit.blockDuration, 'true');
        
        // Log rate limit exceeded
        logger.warn(`Rate limit exceeded for IP: ${ip}, blocked for ${this.rateLimit.blockDuration} seconds`);
        
        return true;
      }
      
      // Update request count
      await redisClient.setEx(`ip:requests:${ip}`, Math.floor(this.rateLimit.windowMs / 1000), newCount.toString());
      
      return false;
    } catch (error) {
      logger.error(`Rate limit check error: ${error.message}`);
      return false; // Allow request on error
    }
  }

  /**
   * IP restriction middleware
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @param {Function} next - Express next function
   */
  async restrict(req, res, next) {
    try {
      // Get client IP
      const ip = req.ip || req.connection.remoteAddress;
      
      // Skip IP checks for health check endpoints
      if (req.path === '/health' || req.path === '/api/health') {
        return next();
      }
      
      // Check if IP is whitelisted
      if (this.isWhitelisted(ip)) {
        return next();
      }
      
      // Check if IP is blacklisted
      if (this.isBlacklisted(ip)) {
        logger.warn(`Blocked request from blacklisted IP: ${ip}`);
        return next(new ApiError(403, 'Access denied'));
      }
      
      // Check if IP is rate limited
      const isRateLimited = await this.isRateLimited(ip);
      
      if (isRateLimited) {
        return next(new ApiError(429, 'Too many requests'));
      }
      
      // Check if country is restricted
      const countryCode = await this.getCountryFromIp(ip);
      
      if (countryCode && this.isCountryRestricted(countryCode)) {
        logger.warn(`Blocked request from restricted country: ${countryCode}, IP: ${ip}`);
        return next(new ApiError(403, 'Access denied from your region'));
      }
      
      // All checks passed
      next();
    } catch (error) {
      logger.error(`IP restriction error: ${error.message}`);
      next(error);
    }
  }

  /**
   * Middleware factory
   * @returns {Function} - Express middleware
   */
  middleware() {
    return this.restrict.bind(this);
  }
}

// Create singleton instance
const ipRestriction = new IpRestriction();

module.exports = {
  ipRestriction,
  ipRestrictionMiddleware: ipRestriction.middleware()
};