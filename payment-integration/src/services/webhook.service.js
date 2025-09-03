const Webhook = require('../models/webhook.model');
const paymentService = require('./payment.service');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

/**
 * Create webhook record
 * @param {Object} data - Webhook data
 * @returns {Promise<Object>} - Created webhook
 */
const createWebhook = async (data) => {
  try {
    const { 
      provider, 
      eventType, 
      eventId, 
      paymentId, 
      providerPaymentId, 
      rawData, 
      ipAddress, 
      headers 
    } = data;
    
    // Create webhook record
    const webhook = new Webhook({
      provider,
      eventType,
      eventId,
      paymentId,
      providerPaymentId,
      rawData,
      ipAddress,
      headers,
      status: 'received'
    });
    
    await webhook.save();
    
    return webhook;
  } catch (error) {
    logger.error(`Create webhook error: ${error.message}`);
    throw new ApiError(500, 'Failed to create webhook record');
  }
};

/**
 * Process webhook
 * @param {String} webhookId - Webhook ID
 * @returns {Promise<Object>} - Processed webhook
 */
const processWebhook = async (webhookId) => {
  try {
    // Find webhook
    const webhook = await Webhook.findById(webhookId);
    
    if (!webhook) {
      throw new ApiError(404, 'Webhook not found');
    }
    
    // Update webhook status
    webhook.status = 'processing';
    await webhook.save();
    
    try {
      // Process webhook with payment service
      const result = await paymentService.processWebhook(webhook.provider, {
        event: webhook.rawData,
        payload: null, // Already verified
        signature: null // Already verified
      });
      
      // Update webhook with processing result
      webhook.status = 'processed';
      webhook.processedData = result;
      webhook.processedAt = new Date();
      
      if (result.payment) {
        webhook.paymentId = result.payment._id;
      }
      
      await webhook.save();
      
      return {
        success: true,
        webhook,
        result
      };
    } catch (error) {
      // Update webhook with error
      webhook.status = 'failed';
      webhook.processingError = error.message;
      await webhook.save();
      
      throw error;
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Process webhook error: ${error.message}`);
    throw new ApiError(500, 'Failed to process webhook');
  }
};

/**
 * Get webhook by ID
 * @param {String} webhookId - Webhook ID
 * @returns {Promise<Object>} - Webhook
 */
const getWebhookById = async (webhookId) => {
  try {
    const webhook = await Webhook.findById(webhookId);
    
    if (!webhook) {
      throw new ApiError(404, 'Webhook not found');
    }
    
    return webhook;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Get webhook error: ${error.message}`);
    throw new ApiError(500, 'Failed to get webhook');
  }
};

/**
 * Get webhooks
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Webhooks with pagination
 */
const getWebhooks = async (options = {}) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      provider, 
      eventType,
      status,
      startDate,
      endDate,
      sort = '-createdAt' 
    } = options;
    
    // Build query
    const query = {};
    
    if (provider) {
      query.provider = provider;
    }
    
    if (eventType) {
      query.eventType = eventType;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }
    
    // Execute query with pagination
    const webhooks = await Webhook.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);
    
    // Get total count
    const total = await Webhook.countDocuments(query);
    
    return {
      webhooks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error(`Get webhooks error: ${error.message}`);
    throw new ApiError(500, 'Failed to get webhooks');
  }
};

/**
 * Retry failed webhook
 * @param {String} webhookId - Webhook ID
 * @returns {Promise<Object>} - Retried webhook
 */
const retryWebhook = async (webhookId) => {
  try {
    // Find webhook
    const webhook = await Webhook.findById(webhookId);
    
    if (!webhook) {
      throw new ApiError(404, 'Webhook not found');
    }
    
    // Check if webhook is failed
    if (webhook.status !== 'failed') {
      throw new ApiError(400, `Webhook with status '${webhook.status}' cannot be retried`);
    }
    
    // Process webhook
    return await processWebhook(webhookId);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Retry webhook error: ${error.message}`);
    throw new ApiError(500, 'Failed to retry webhook');
  }
};

/**
 * Delete webhook
 * @param {String} webhookId - Webhook ID
 * @returns {Promise<Object>} - Deleted webhook
 */
const deleteWebhook = async (webhookId) => {
  try {
    const webhook = await Webhook.findById(webhookId);
    
    if (!webhook) {
      throw new ApiError(404, 'Webhook not found');
    }
    
    await webhook.deleteOne();
    
    return { success: true, message: 'Webhook deleted successfully' };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Delete webhook error: ${error.message}`);
    throw new ApiError(500, 'Failed to delete webhook');
  }
};

/**
 * Get webhook statistics
 * @returns {Promise<Object>} - Webhook statistics
 */
const getWebhookStatistics = async () => {
  try {
    // Get total webhooks
    const totalWebhooks = await Webhook.countDocuments();
    
    // Get webhooks by status
    const webhooksByStatus = await Webhook.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get webhooks by provider
    const webhooksByProvider = await Webhook.aggregate([
      {
        $group: {
          _id: '$provider',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get webhooks by event type
    const webhooksByEventType = await Webhook.aggregate([
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Format statistics
    const formattedWebhooksByStatus = {};
    webhooksByStatus.forEach(item => {
      formattedWebhooksByStatus[item._id] = item.count;
    });
    
    const formattedWebhooksByProvider = {};
    webhooksByProvider.forEach(item => {
      formattedWebhooksByProvider[item._id] = item.count;
    });
    
    const formattedWebhooksByEventType = {};
    webhooksByEventType.forEach(item => {
      formattedWebhooksByEventType[item._id] = item.count;
    });
    
    return {
      totalWebhooks,
      webhooksByStatus: formattedWebhooksByStatus,
      webhooksByProvider: formattedWebhooksByProvider,
      webhooksByEventType: formattedWebhooksByEventType
    };
  } catch (error) {
    logger.error(`Get webhook statistics error: ${error.message}`);
    throw new ApiError(500, 'Failed to get webhook statistics');
  }
};

module.exports = {
  createWebhook,
  processWebhook,
  getWebhookById,
  getWebhooks,
  retryWebhook,
  deleteWebhook,
  getWebhookStatistics
};