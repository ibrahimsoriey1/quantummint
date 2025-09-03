const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, requireModerator, requireKYCLevel } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// Create settlement batch
router.post('/batch',
  authenticateToken,
  requireModerator,
  [
    body('provider').isIn(['stripe', 'orange-money', 'afrimoney']),
    body('currency').isIn(['USD', 'EUR', 'GBP', 'XOF', 'XAF']),
    body('settlementDate').isISO8601(),
    body('description').optional().isString().max(500),
    body('metadata').optional().isObject()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const settlementData = req.body;

    // Create settlement batch
    const settlement = await createSettlementBatch(settlementData, req.user.id);

    logger.settlement('Settlement batch created successfully', {
      settlementId: settlement.settlementId,
      provider: settlement.provider,
      currency: settlement.currency,
      amount: settlement.totalAmount,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: settlement,
      message: 'Settlement batch created successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Get settlement by ID
router.get('/:settlementId',
  authenticateToken,
  requireModerator,
  [
    param('settlementId').isString().notEmpty()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { settlementId } = req.params;

    // Get settlement details
    const settlement = await getSettlementById(settlementId);

    res.json({
      success: true,
      data: settlement,
      timestamp: new Date().toISOString()
    });
  })
);

// Get settlement history
router.get('/history',
  authenticateToken,
  requireModerator,
  [
    query('provider').optional().isIn(['stripe', 'orange-money', 'afrimoney']),
    query('status').optional().isIn(['pending', 'processing', 'completed', 'failed']),
    query('currency').optional().isIn(['USD', 'EUR', 'GBP', 'XOF', 'XAF']),
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
      currency,
      startDate,
      endDate,
      limit = 20,
      offset = 0
    } = req.query;

    // Get settlement history
    const settlements = await getSettlementHistory({
      provider,
      status,
      currency,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: settlements,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: settlements.length
      },
      timestamp: new Date().toISOString()
    });
  })
);

// Process settlement
router.post('/:settlementId/process',
  authenticateToken,
  requireModerator,
  [
    param('settlementId').isString().notEmpty(),
    body('force').optional().isBoolean()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { settlementId } = req.params;
    const { force = false } = req.body;

    // Process settlement
    const result = await processSettlement(settlementId, force, req.user.id);

    logger.settlement('Settlement processing initiated', {
      settlementId,
      status: result.status,
      processedBy: req.user.id,
      force
    });

    res.json({
      success: true,
      message: 'Settlement processing initiated',
      data: result,
      timestamp: new Date().toISOString()
    });
  })
);

// Cancel settlement
router.post('/:settlementId/cancel',
  authenticateToken,
  requireAdmin,
  [
    param('settlementId').isString().notEmpty(),
    body('reason').isString().notEmpty().max(500)
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { settlementId } = req.params;
    const { reason } = req.body;

    // Cancel settlement
    const result = await cancelSettlement(settlementId, reason, req.user.id);

    logger.settlement('Settlement cancelled', {
      settlementId,
      reason,
      cancelledBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Settlement cancelled successfully',
      data: result,
      timestamp: new Date().toISOString()
    });
  })
);

// Get settlement statistics
router.get('/stats/overview',
  authenticateToken,
  requireModerator,
  asyncHandler(async (req, res) => {
    // Get settlement statistics
    const stats = await getSettlementStatistics();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  })
);

// Admin: Update settlement configuration
router.put('/config',
  authenticateToken,
  requireAdmin,
  [
    body('batchSize').optional().isInt({ min: 10, max: 1000 }),
    body('intervalHours').optional().isInt({ min: 1, max: 168 }),
    body('currencies').optional().isArray(),
    body('thresholdAmount').optional().isFloat({ min: 0 }),
    body('autoProcessing').optional().isBoolean()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const configData = req.body;

    // Update settlement configuration
    const config = await updateSettlementConfig(configData);

    logger.settlement('Settlement configuration updated', {
      updatedBy: req.user.id,
      changes: Object.keys(configData)
    });

    res.json({
      success: true,
      message: 'Settlement configuration updated successfully',
      data: config,
      timestamp: new Date().toISOString()
    });
  })
);

// Helper functions
async function createSettlementBatch(settlementData, userId) {
  // This would implement settlement batch creation logic
  // For now, return mock data
  return {
    settlementId: `settlement_${Date.now()}`,
    provider: settlementData.provider,
    currency: settlementData.currency,
    totalAmount: 10000.00,
    totalTransactions: 150,
    status: 'pending',
    settlementDate: settlementData.settlementDate,
    createdBy: userId,
    createdAt: new Date().toISOString(),
    description: settlementData.description,
    metadata: settlementData.metadata || {}
  };
}

async function getSettlementById(settlementId) {
  // This would query the database for settlement details
  // For now, return mock data
  return {
    settlementId,
    provider: 'stripe',
    currency: 'USD',
    totalAmount: 10000.00,
    totalTransactions: 150,
    status: 'pending',
    settlementDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'user_123',
    createdAt: new Date().toISOString(),
    description: 'Daily settlement batch',
    metadata: {},
    transactions: [
      {
        transactionId: 'txn_1',
        amount: 100.00,
        status: 'pending'
      }
    ]
  };
}

async function getSettlementHistory(filters) {
  // This would query the database for settlement history
  // For now, return mock data
  return [
    {
      settlementId: 'settlement_1',
      provider: 'stripe',
      currency: 'USD',
      totalAmount: 10000.00,
      status: 'completed',
      settlementDate: new Date().toISOString(),
      completedAt: new Date().toISOString()
    }
  ];
}

async function processSettlement(settlementId, force, userId) {
  // This would implement settlement processing logic
  // For now, return mock data
  return {
    settlementId,
    status: 'processing',
    processedBy: userId,
    processedAt: new Date().toISOString(),
    estimatedCompletion: new Date(Date.now() + 30 * 60 * 1000).toISOString()
  };
}

async function cancelSettlement(settlementId, reason, userId) {
  // This would implement settlement cancellation logic
  // For now, return mock data
  return {
    settlementId,
    status: 'cancelled',
    cancelledBy: userId,
    cancelledAt: new Date().toISOString(),
    reason
  };
}

async function getSettlementStatistics() {
  // This would aggregate settlement statistics from the database
  // For now, return mock data
  return {
    total: 100,
    pending: 20,
    processing: 10,
    completed: 60,
    failed: 10,
    byProvider: {
      stripe: { total: 60, completed: 40, failed: 5 },
      'orange-money': { total: 25, completed: 15, failed: 3 },
      afrimoney: { total: 15, completed: 5, failed: 2 }
    },
    byCurrency: {
      USD: { total: 70, completed: 45, failed: 8 },
      EUR: { total: 20, completed: 12, failed: 1 },
      XOF: { total: 10, completed: 3, failed: 1 }
    }
  };
}

async function updateSettlementConfig(configData) {
  // This would update settlement configuration in the database
  // For now, return mock data
  return {
    batchSize: configData.batchSize || 100,
    intervalHours: configData.intervalHours || 24,
    currencies: configData.currencies || ['USD', 'EUR', 'GBP'],
    thresholdAmount: configData.thresholdAmount || 1000.00,
    autoProcessing: configData.autoProcessing !== undefined ? configData.autoProcessing : true,
    updatedAt: new Date().toISOString()
  };
}

module.exports = router;
