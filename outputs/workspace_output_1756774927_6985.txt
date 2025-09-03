const webhookService = require('../services/webhook.service');
const paymentService = require('../services/payment.service');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

/**
 * Handle Stripe webhook
 * @route POST /api/webhooks/stripe
 */
exports.handleStripeWebhook = async (req, res, next) => {
  try {
    // Get signature from headers
    const signature = req.headers['stripe-signature'];
    
    if (!signature) {
      return next(new ApiError(400, 'Stripe signature is required'));
    }
    
    // Create webhook record
    const webhook = await webhookService.createWebhook({
      provider: 'stripe',
      eventType: req.body.type,
      eventId: req.body.id,
      providerPaymentId: req.body.data?.object?.id,
      rawData: req.body,
      ipAddress: req.ip,
      headers: req.headers
    });
    
    // Process webhook asynchronously
    setImmediate(async () => {
      try {
        await webhookService.processWebhook(webhook._id);
      } catch (error) {
        logger.error(`Failed to process Stripe webhook: ${error.message}`);
      }
    });
    
    // Respond immediately to Stripe
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error(`Stripe webhook error: ${error.message}`);
    
    // Always respond with 200 to Stripe to prevent retries
    res.status(200).json({ received: true, error: error.message });
  }
};

/**
 * Handle Orange Money webhook
 * @route POST /api/webhooks/orange-money
 */
exports.handleOrangeMoneyWebhook = async (req, res, next) => {
  try {
    // Get signature from headers
    const signature = req.headers['x-orange-signature'];
    const timestamp = req.headers['x-orange-timestamp'];
    
    if (!signature || !timestamp) {
      return next(new ApiError(400, 'Orange Money signature and timestamp are required'));
    }
    
    // Create webhook record
    const webhook = await webhookService.createWebhook({
      provider: 'orange_money',
      eventType: req.body.type,
      eventId: req.body.id,
      providerPaymentId: req.body.data?.paymentId || req.body.data?.transferId,
      rawData: req.body,
      ipAddress: req.ip,
      headers: req.headers
    });
    
    // Process webhook asynchronously
    setImmediate(async () => {
      try {
        await webhookService.processWebhook(webhook._id);
      } catch (error) {
        logger.error(`Failed to process Orange Money webhook: ${error.message}`);
      }
    });
    
    // Respond immediately to Orange Money
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error(`Orange Money webhook error: ${error.message}`);
    
    // Always respond with 200 to prevent retries
    res.status(200).json({ received: true, error: error.message });
  }
};

/**
 * Handle AfriMoney webhook
 * @route POST /api/webhooks/afrimoney
 */
exports.handleAfriMoneyWebhook = async (req, res, next) => {
  try {
    // Get signature from headers
    const signature = req.headers['x-afrimoney-signature'];
    const timestamp = req.headers['x-afrimoney-timestamp'];
    
    if (!signature || !timestamp) {
      return next(new ApiError(400, 'AfriMoney signature and timestamp are required'));
    }
    
    // Create webhook record
    const webhook = await webhookService.createWebhook({
      provider: 'afrimoney',
      eventType: req.body.type,
      eventId: req.body.id,
      providerPaymentId: req.body.data?.paymentId || req.body.data?.disbursementId,
      rawData: req.body,
      ipAddress: req.ip,
      headers: req.headers
    });
    
    // Process webhook asynchronously
    setImmediate(async () => {
      try {
        await webhookService.processWebhook(webhook._id);
      } catch (error) {
        logger.error(`Failed to process AfriMoney webhook: ${error.message}`);
      }
    });
    
    // Respond immediately to AfriMoney
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error(`AfriMoney webhook error: ${error.message}`);
    
    // Always respond with 200 to prevent retries
    res.status(200).json({ received: true, error: error.message });
  }
};

/**
 * Get webhook by ID
 * @route GET /api/webhooks/:id
 */
exports.getWebhookById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const webhook = await webhookService.getWebhookById(id);
    
    res.status(200).json({
      success: true,
      data: webhook
    });
  } catch (error) {
    logger.error(`Get webhook error: ${error.message}`);
    next(error);
  }
};

/**
 * Get all webhooks
 * @route GET /api/webhooks
 */
exports.getWebhooks = async (req, res, next) => {
  try {
    const { 
      page, 
      limit, 
      provider, 
      eventType,
      status,
      startDate,
      endDate,
      sort 
    } = req.query;
    
    const result = await webhookService.getWebhooks({
      page,
      limit,
      provider,
      eventType,
      status,
      startDate,
      endDate,
      sort
    });
    
    res.status(200).json({
      success: true,
      data: result.webhooks,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error(`Get webhooks error: ${error.message}`);
    next(error);
  }
};

/**
 * Retry webhook
 * @route POST /api/webhooks/:id/retry
 */
exports.retryWebhook = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await webhookService.retryWebhook(id);
    
    res.status(200).json({
      success: true,
      message: 'Webhook retried successfully',
      data: result
    });
  } catch (error) {
    logger.error(`Retry webhook error: ${error.message}`);
    next(error);
  }
};

/**
 * Delete webhook
 * @route DELETE /api/webhooks/:id
 */
exports.deleteWebhook = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await webhookService.deleteWebhook(id);
    
    res.status(200).json({
      success: true,
      message: 'Webhook deleted successfully'
    });
  } catch (error) {
    logger.error(`Delete webhook error: ${error.message}`);
    next(error);
  }
};

/**
 * Get webhook statistics
 * @route GET /api/webhooks/statistics
 */
exports.getWebhookStatistics = async (req, res, next) => {
  try {
    const statistics = await webhookService.getWebhookStatistics();
    
    res.status(200).json({
      success: true,
      data: statistics
    });
  } catch (error) {
    logger.error(`Get webhook statistics error: ${error.message}`);
    next(error);
  }
};