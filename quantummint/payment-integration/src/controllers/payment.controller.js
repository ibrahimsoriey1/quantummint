const paymentService = require('../services/payment-integration.service');
const { validateCashOutRequest } = require('../validation/payment.validation');
const { PaymentError } = require('../utils/errors.util');
const logger = require('../utils/logger.util');

/**
 * Get available payment providers
 */
exports.getProviders = async (req, res) => {
  try {
    const providers = await paymentService.getAvailableProviders();
    
    return res.status(200).json({
      success: true,
      data: {
        providers
      }
    });
  } catch (error) {
    logger.error(`Get providers controller error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while retrieving payment providers'
      }
    });
  }
};

/**
 * Process cash out request
 */
exports.processCashOut = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Validate request
    const { error, value } = validateCashOutRequest(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid cash out request',
          details: error.details.map(d => ({ field: d.path[0], message: d.message }))
        }
      });
    }
    
    // Add userId to cash out data
    value.userId = userId;
    
    // Process cash out
    const result = await paymentService.processCashOut(value);
    
    return res.status(200).json({
      success: true,
      message: 'Cash out request initiated',
      data: result
    });
  } catch (error) {
    if (error instanceof PaymentError) {
      return res.status(400).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }
    
    logger.error(`Process cash out controller error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during cash out processing'
      }
    });
  }
};

/**
 * Get cash out status
 */
exports.getCashOutStatus = async (req, res) => {
  try {
    const { cashOutId } = req.params;
    const userId = req.user.userId;
    
    // Get cash out status
    const cashOut = await paymentService.getCashOutStatus(cashOutId);
    
    // Check if user has permission to view this cash out
    if (cashOut.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this cash out'
        }
      });
    }
    
    return res.status(200).json({
      success: true,
      data: cashOut
    });
  } catch (error) {
    if (error instanceof PaymentError) {
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
      }
      
      return res.status(400).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }
    
    logger.error(`Get cash out status controller error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while retrieving cash out status'
      }
    });
  }
};

/**
 * Get cash out history
 */
exports.getCashOutHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page, limit, status, provider, startDate, endDate, walletId } = req.query;
    
    // Get cash out history
    const result = await paymentService.getCashOutHistory(userId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      status,
      provider,
      startDate,
      endDate,
      walletId
    });
    
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error(`Get cash out history controller error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while retrieving cash out history'
      }
    });
  }
};

/**
 * Handle webhook from payment provider
 */
exports.handleWebhook = async (req, res) => {
  try {
    const { provider } = req.params;
    const payload = req.body;
    const headers = req.headers;
    
    // Process webhook
    const result = await paymentService.handleWebhook(provider, payload, headers);
    
    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      data: result
    });
  } catch (error) {
    logger.error(`Webhook controller error: ${error.message}`);
    
    // Always return 200 for webhooks to prevent retries
    return res.status(200).json({
      success: false,
      error: {
        message: 'Webhook processing failed'
      }
    });
  }
};