const jwt = require('jsonwebtoken');
const logger = require('../utils/logger.util');

/**
 * Middleware to verify JWT token
 */
exports.verifyToken = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token is required'
        }
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Add user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
    
    next();
  } catch (error) {
    logger.error(`Authentication error: ${error.message}`);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Authentication token has expired'
        }
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token'
        }
      });
    }
    
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication failed'
      }
    });
  }
};

/**
 * Middleware to check if user has admin role
 */
exports.requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required'
      }
    });
  }
  
  next();
};

/**
 * Middleware to verify webhook signatures
 * This middleware is used for webhook endpoints that don't require JWT authentication
 */
exports.verifyWebhookSignature = (provider) => {
  return (req, res, next) => {
    try {
      const payload = req.body;
      const headers = req.headers;
      
      // Implement provider-specific signature verification
      switch (provider) {
        case 'orange_money':
          verifyOrangeMoneySignature(payload, headers);
          break;
        
        case 'afrimoney':
          verifyAfriMoneySignature(payload, headers);
          break;
          
        case 'stripe':
          verifyStripeSignature(payload, headers);
          break;
        
        default:
          throw new Error('Unsupported payment provider');
      }
      
      next();
    } catch (error) {
      logger.error(`Webhook signature verification error: ${error.message}`);
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Invalid webhook signature'
        }
      });
    }
  };
};

/**
 * Verify Orange Money webhook signature
 * @param {Object} payload - Webhook payload
 * @param {Object} headers - Webhook headers
 */
function verifyOrangeMoneySignature(payload, headers) {
  const crypto = require('crypto');
  const signature = headers['x-signature'];
  
  if (!signature) {
    throw new Error('Missing signature');
  }
  
  const webhookSecret = process.env.ORANGE_MONEY_WEBHOOK_SECRET;
  const payloadString = JSON.stringify(payload);
  
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payloadString)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    throw new Error('Invalid signature');
  }
}

/**
 * Verify AfriMoney webhook signature
 * @param {Object} payload - Webhook payload
 * @param {Object} headers - Webhook headers
 */
function verifyAfriMoneySignature(payload, headers) {
  const crypto = require('crypto');
  const signature = headers['x-signature'];
  const timestamp = headers['x-timestamp'];
  
  if (!signature || !timestamp) {
    throw new Error('Missing signature or timestamp');
  }
  
  const apiKey = process.env.AFRIMONEY_API_KEY;
  const apiSecret = process.env.AFRIMONEY_API_SECRET;
  const reference = payload.externalReference || payload.transactionId;
  
  const signatureData = `${apiKey}${timestamp}${reference}`;
  const expectedSignature = crypto
    .createHmac('sha256', apiSecret)
    .update(signatureData)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    throw new Error('Invalid signature');
  }
}

/**
 * Verify Stripe webhook signature
 * @param {Object} payload - Webhook payload
 * @param {Object} headers - Webhook headers
 */
function verifyStripeSignature(payload, headers) {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const signature = headers['stripe-signature'];
  
  if (!signature) {
    throw new Error('Missing signature');
  }
  
  try {
    // Verify the event by fetching it from Stripe
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    
    // Attach the event to the request for later use
    req.stripeEvent = event;
  } catch (error) {
    throw new Error(`Stripe signature verification failed: ${error.message}`);
  }
}