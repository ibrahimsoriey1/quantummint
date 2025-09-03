const fraudDetectionService = require('../services/fraudDetection.service');
const { logger } = require('../utils/logger');
const { ApiError } = require('./errorHandler');
require('dotenv').config();

/**
 * Fraud detection middleware
 * Analyzes requests for suspicious patterns and blocks potentially fraudulent transactions
 */
const fraudDetectionMiddleware = async (req, res, next) => {
  try {
    // Skip fraud detection for non-transaction endpoints
    const transactionEndpoints = [
      '/api/payments',
      '/api/transactions',
      '/api/generation',
      '/api/withdrawals'
    ];
    
    const isTransactionEndpoint = transactionEndpoints.some(endpoint => 
      req.path.startsWith(endpoint) && req.method === 'POST'
    );
    
    if (!isTransactionEndpoint) {
      return next();
    }
    
    // Skip fraud detection for admin routes
    if (req.path.includes('/admin/')) {
      return next();
    }
    
    // Extract transaction data
    const userId = req.user?.id;
    
    if (!userId) {
      return next(); // Skip fraud detection if user is not authenticated
    }
    
    // Extract transaction data from request body
    const { amount, currency, transactionType } = req.body;
    
    // Extract device information from headers
    const deviceId = req.headers['x-device-id'] || req.headers['user-agent'];
    const ip = req.ip || req.connection.remoteAddress;
    
    // Extract payment method if available
    const paymentMethod = req.body.paymentMethod || req.body.provider;
    
    // Evaluate transaction risk
    const riskEvaluation = await fraudDetectionService.evaluateTransactionRisk({
      userId,
      amount: parseFloat(amount) || 0,
      currency: currency || 'USD',
      ip,
      deviceId,
      transactionType: transactionType || req.path.split('/').pop(),
      paymentMethod
    });
    
    // Add risk evaluation to request for downstream services
    req.riskEvaluation = riskEvaluation;
    
    // If transaction is high risk but passed, add a header for downstream services
    if (riskEvaluation.requiresReview) {
      res.setHeader('X-Risk-Level', 'high');
      res.setHeader('X-Risk-Score', riskEvaluation.riskScore.toString());
    }
    
    // If transaction failed risk evaluation, block it
    if (!riskEvaluation.passed) {
      logger.warn(`Blocked suspicious transaction: userId=${userId}, riskScore=${riskEvaluation.riskScore}, reasons=${riskEvaluation.reasons.join(', ')}`);
      
      // Record failed attempt
      await fraudDetectionService.recordFailedAttempt(userId);
      
      return next(new ApiError(403, 'Transaction blocked due to suspicious activity'));
    }
    
    // Transaction passed fraud detection
    next();
  } catch (error) {
    logger.error(`Fraud detection error: ${error.message}`);
    next(); // Allow transaction on error
  }
};

module.exports = fraudDetectionMiddleware;