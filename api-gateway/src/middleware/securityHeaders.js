const { logger } = require('../utils/logger');
require('dotenv').config();

/**
 * Security headers middleware
 * Adds security-related HTTP headers to API responses
 */
const securityHeadersMiddleware = (req, res, next) => {
  try {
    // Content Security Policy
    // Restricts sources of content that can be loaded
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    );
    
    // X-Content-Type-Options
    // Prevents MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // X-Frame-Options
    // Prevents clickjacking attacks
    res.setHeader('X-Frame-Options', 'DENY');
    
    // X-XSS-Protection
    // Enables browser's XSS filtering
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Strict-Transport-Security
    // Enforces HTTPS connections
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
    
    // Referrer-Policy
    // Controls how much referrer information is included with requests
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions-Policy (formerly Feature-Policy)
    // Restricts which browser features can be used
    res.setHeader(
      'Permissions-Policy',
      'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
    );
    
    // Cache-Control
    // Controls caching behavior
    if (req.method === 'GET') {
      // Allow caching for GET requests to static resources
      if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
      } else {
        // No caching for API responses
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    } else {
      // No caching for non-GET requests
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    
    // Cross-Origin-Resource-Policy
    // Prevents cross-origin loading of resources
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    
    // Cross-Origin-Opener-Policy
    // Controls cross-origin sharing of browsing context group
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    
    // Cross-Origin-Embedder-Policy
    // Prevents loading of cross-origin resources that don't explicitly grant permission
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    
    next();
  } catch (error) {
    logger.error(`Security headers error: ${error.message}`);
    next(); // Continue even if headers can't be set
  }
};

module.exports = securityHeadersMiddleware;