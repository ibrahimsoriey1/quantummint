const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, requireModerator, verifyWebhookSignature } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// Process webhook from payment provider
router.post('/:provider',
  [
    param('provider').isIn(['stripe', 'orange-money', 'afrimoney']),
    body().notEmpty()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { provider } = req.params;
    const webhookData = req.body;

    // Verify webhook signature
    verifyWebhookSignature(provider)(req, res, async () => {
      try {
        // Process webhook
        const result = await processWebhook(provider, webhookData);

        logger.webhook('Webhook processed successfully', {
          provider,
          webhookId: result.webhookId,
          eventType: result.eventType,
          status: result.status
        });

        res.json({
          success: true,
          message: 'Webhook processed successfully',
          data: result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Webhook processing failed:', error);
        res.status(500).json({
          error: 'Webhook processing failed',
          code: 'WEBHOOK_PROCESSING_FAILED'
        });
      }
    });
  })
);

// Get webhook history
router.get('/history',
  authenticateToken,
  requireModerator,
  [
    query('provider').optional().isIn(['stripe', 'orange-money', 'afrimoney']),
    query('status').optional().isIn(['success', 'failed', 'pending']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      provider,
      status,
      startDate,
      endDate,
      limit = 20,
      offset = 0
    } = req.query;

    // Get webhook history
    const webhooks = await getWebhookHistory({
      provider,
      status,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: webhooks,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: webhooks.length
      },
      timestamp: new Date().toISOString()
    });
  })
);

// Get webhook by ID
router.get('/:webhookId',
  authenticateToken,
  requireModerator,
  [
    param('webhookId').isString().notEmpty()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { webhookId } = req.params;

    // Get webhook details
    const webhook = await getWebhookById(webhookId);

    res.json({
      success: true,
      data: webhook,
      timestamp: new Date().toISOString()
    });
  })
);

// Retry failed webhook
router.post('/:webhookId/retry',
  authenticateToken,
  requireModerator,
  [
    param('webhookId').isString().notEmpty()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { webhookId } = req.params;

    // Retry webhook processing
    const result = await retryWebhook(webhookId);

    logger.webhook('Webhook retry initiated', {
      webhookId,
      status: result.status,
      retryCount: result.retryCount
    });

    res.json({
      success: true,
      message: 'Webhook retry initiated',
      data: result,
      timestamp: new Date().toISOString()
    });
  })
);

// Get webhook statistics
router.get('/stats/overview',
  authenticateToken,
  requireModerator,
  asyncHandler(async (req, res) => {
    // Get webhook statistics
    const stats = await getWebhookStatistics();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  })
);

// Admin: Update webhook configuration
router.put('/config/:provider',
  authenticateToken,
  requireAdmin,
  [
    param('provider').isIn(['stripe', 'orange-money', 'afrimoney']),
    body('webhookUrl').optional().isURL(),
    body('secret').optional().isString(),
    body('enabled').optional().isBoolean(),
    body('retryAttempts').optional().isInt({ min: 1, max: 10 }),
    body('timeout').optional().isInt({ min: 1000, max: 30000 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { provider } = req.params;
    const configData = req.body;

    // Update webhook configuration
    const config = await updateWebhookConfig(provider, configData);

    logger.webhook('Webhook configuration updated', {
      provider,
      updatedBy: req.user.id,
      changes: Object.keys(configData)
    });

    res.json({
      success: true,
      message: 'Webhook configuration updated successfully',
      data: config,
      timestamp: new Date().toISOString()
    });
  })
);

// Helper functions
async function processWebhook(provider, webhookData) {
  // This would implement actual webhook processing logic
  // For now, return mock data
  return {
    webhookId: `webhook_${Date.now()}`,
    provider,
    eventType: webhookData.type || 'payment.succeeded',
    status: 'success',
    processedAt: new Date().toISOString(),
    data: webhookData
  };
}

async function getWebhookHistory(filters) {
  // This would query the database for webhook history
  // For now, return mock data
  return [
    {
      webhookId: 'webhook_1',
      provider: 'stripe',
      eventType: 'payment.succeeded',
      status: 'success',
      receivedAt: new Date().toISOString(),
      processedAt: new Date().toISOString()
    }
  ];
}

async function getWebhookById(webhookId) {
  // This would query the database for webhook details
  // For now, return mock data
  return {
    webhookId,
    provider: 'stripe',
    eventType: 'payment.succeeded',
    status: 'success',
    receivedAt: new Date().toISOString(),
    processedAt: new Date().toISOString(),
    data: { type: 'payment.succeeded', id: 'evt_123' }
  };
}

async function retryWebhook(webhookId) {
  // This would implement webhook retry logic
  // For now, return mock data
  return {
    webhookId,
    status: 'retrying',
    retryCount: 1,
    nextRetryAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
  };
}

async function getWebhookStatistics() {
  // This would aggregate webhook statistics from the database
  // For now, return mock data
  return {
    total: 1000,
    success: 950,
    failed: 50,
    byProvider: {
      stripe: { total: 600, success: 580, failed: 20 },
      'orange-money': { total: 250, success: 240, failed: 10 },
      afrimoney: { total: 150, success: 130, failed: 20 }
    },
    byStatus: {
      success: 950,
      failed: 50,
      pending: 0
    }
  };
}

async function updateWebhookConfig(provider, configData) {
  // This would update webhook configuration in the database
  // For now, return mock data
  return {
    provider,
    webhookUrl: configData.webhookUrl || 'https://example.com/webhook',
    secret: configData.secret || 'secret_key',
    enabled: configData.enabled !== undefined ? configData.enabled : true,
    retryAttempts: configData.retryAttempts || 3,
    timeout: configData.timeout || 10000,
    updatedAt: new Date().toISOString()
  };
}

module.exports = router;
