const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, requireModerator } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// Get all payment providers
router.get('/',
  authenticateToken,
  requireModerator,
  asyncHandler(async (req, res) => {
    // Get all payment providers
    const providers = await getAllPaymentProviders();

    res.json({
      success: true,
      data: providers,
      timestamp: new Date().toISOString()
    });
  })
);

// Get payment provider by ID
router.get('/:providerId',
  authenticateToken,
  requireModerator,
  [
    param('providerId').isString().notEmpty()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { providerId } = req.params;

    // Get provider details
    const provider = await getPaymentProviderById(providerId);

    res.json({
      success: true,
      data: provider,
      timestamp: new Date().toISOString()
    });
  })
);

// Create new payment provider
router.post('/',
  authenticateToken,
  requireAdmin,
  [
    body('name').isString().notEmpty().max(100),
    body('type').isIn(['stripe', 'orange-money', 'afrimoney', 'custom']),
    body('config').isObject(),
    body('enabled').optional().isBoolean(),
    body('description').optional().isString().max(500),
    body('metadata').optional().isObject()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const providerData = req.body;

    // Create payment provider
    const provider = await createPaymentProvider(providerData, req.user.id);

    logger.provider('Payment provider created successfully', {
      providerId: provider.providerId,
      name: provider.name,
      type: provider.type,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: provider,
      message: 'Payment provider created successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Update payment provider
router.put('/:providerId',
  authenticateToken,
  requireAdmin,
  [
    param('providerId').isString().notEmpty(),
    body('name').optional().isString().notEmpty().max(100),
    body('config').optional().isObject(),
    body('enabled').optional().isBoolean(),
    body('description').optional().isString().max(500),
    body('metadata').optional().isObject()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { providerId } = req.params;
    const updateData = req.body;

    // Update payment provider
    const provider = await updatePaymentProvider(providerId, updateData, req.user.id);

    logger.provider('Payment provider updated successfully', {
      providerId,
      updatedBy: req.user.id,
      changes: Object.keys(updateData)
    });

    res.json({
      success: true,
      data: provider,
      message: 'Payment provider updated successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Delete payment provider
router.delete('/:providerId',
  authenticateToken,
  requireAdmin,
  [
    param('providerId').isString().notEmpty()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { providerId } = req.params;

    // Delete payment provider
    await deletePaymentProvider(providerId, req.user.id);

    logger.provider('Payment provider deleted successfully', {
      providerId,
      deletedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Payment provider deleted successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Test payment provider connection
router.post('/:providerId/test',
  authenticateToken,
  requireModerator,
  [
    param('providerId').isString().notEmpty()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { providerId } = req.params;

    // Test provider connection
    const result = await testPaymentProviderConnection(providerId);

    logger.provider('Payment provider connection tested', {
      providerId,
      status: result.status,
      testedBy: req.user.id
    });

    res.json({
      success: true,
      data: result,
      message: 'Provider connection test completed',
      timestamp: new Date().toISOString()
    });
  })
);

// Get provider statistics
router.get('/:providerId/stats',
  authenticateToken,
  requireModerator,
  [
    param('providerId').isString().notEmpty(),
    query('period').optional().isIn(['hour', 'day', 'week', 'month', 'year']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { providerId } = req.params;
    const { period = 'day', startDate, endDate } = req.query;

    // Get provider statistics
    const stats = await getProviderStatistics(providerId, {
      period,
      startDate,
      endDate
    });

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  })
);

// Admin: Update provider configuration
router.put('/:providerId/config',
  authenticateToken,
  requireAdmin,
  [
    param('providerId').isString().notEmpty(),
    body('config').isObject()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { providerId } = req.params;
    const { config } = req.body;

    // Update provider configuration
    const result = await updateProviderConfiguration(providerId, config, req.user.id);

    logger.provider('Provider configuration updated', {
      providerId,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: result,
      message: 'Provider configuration updated successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Helper functions
async function getAllPaymentProviders() {
  // This would query the database for all payment providers
  // For now, return mock data
  return [
    {
      providerId: 'stripe_1',
      name: 'Stripe',
      type: 'stripe',
      enabled: true,
      description: 'Stripe payment processor',
      config: {
        secretKey: 'sk_test_...',
        publishableKey: 'pk_test_...',
        webhookSecret: 'whsec_...'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      providerId: 'orange_money_1',
      name: 'Orange Money',
      type: 'orange-money',
      enabled: true,
      description: 'Orange Money mobile money',
      config: {
        merchantId: 'merchant_123',
        clientId: 'client_123',
        clientSecret: 'secret_123'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
}

async function getPaymentProviderById(providerId) {
  // This would query the database for provider details
  // For now, return mock data
  return {
    providerId,
    name: 'Stripe',
    type: 'stripe',
    enabled: true,
    description: 'Stripe payment processor',
    config: {
      secretKey: 'sk_test_...',
      publishableKey: 'pk_test_...',
      webhookSecret: 'whsec_...'
    },
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

async function createPaymentProvider(providerData, userId) {
  // This would implement provider creation logic
  // For now, return mock data
  return {
    providerId: `provider_${Date.now()}`,
    name: providerData.name,
    type: providerData.type,
    enabled: providerData.enabled !== undefined ? providerData.enabled : true,
    description: providerData.description,
    config: providerData.config,
    metadata: providerData.metadata || {},
    createdBy: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

async function updatePaymentProvider(providerId, updateData, userId) {
  // This would implement provider update logic
  // For now, return mock data
  return {
    providerId,
    name: updateData.name || 'Stripe',
    type: 'stripe',
    enabled: updateData.enabled !== undefined ? updateData.enabled : true,
    description: updateData.description || 'Stripe payment processor',
    config: updateData.config || {},
    metadata: updateData.metadata || {},
    updatedBy: userId,
    updatedAt: new Date().toISOString()
  };
}

async function deletePaymentProvider(providerId, userId) {
  // This would implement provider deletion logic
  // For now, return success
  return true;
}

async function testPaymentProviderConnection(providerId) {
  // This would implement connection testing logic
  // For now, return mock data
  return {
    providerId,
    status: 'success',
    responseTime: 150,
    testedAt: new Date().toISOString(),
    details: {
      connection: 'established',
      authentication: 'successful',
      apiAccess: 'available'
    }
  };
}

async function getProviderStatistics(providerId, filters) {
  // This would aggregate provider statistics from the database
  // For now, return mock data
  return {
    providerId,
    period: filters.period,
    totalTransactions: 1000,
    successfulTransactions: 950,
    failedTransactions: 50,
    totalAmount: 50000.00,
    averageAmount: 50.00,
    byStatus: {
      pending: 20,
      processing: 30,
      completed: 900,
      failed: 50
    },
    byCurrency: {
      USD: { count: 600, amount: 30000.00 },
      EUR: { count: 300, amount: 15000.00 },
      XOF: { count: 100, amount: 5000.00 }
    }
  };
}

async function updateProviderConfiguration(providerId, config, userId) {
  // This would update provider configuration in the database
  // For now, return mock data
  return {
    providerId,
    config,
    updatedBy: userId,
    updatedAt: new Date().toISOString()
  };
}

module.exports = router;
