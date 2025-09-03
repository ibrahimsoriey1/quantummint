const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, requireModerator } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// Analyze payment for fraud
router.post('/analyze',
  authenticateToken,
  requireModerator,
  [
    body('paymentId').isString().notEmpty(),
    body('userId').isString().notEmpty(),
    body('amount').isFloat({ min: 0.01 }),
    body('currency').isIn(['USD', 'EUR', 'GBP', 'XOF', 'XAF']),
    body('paymentMethod').isString().notEmpty(),
    body('provider').isIn(['stripe', 'orange-money', 'afrimoney']),
    body('metadata').optional().isObject()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const fraudData = req.body;

    // Analyze payment for fraud
    const analysis = await analyzePaymentForFraud(fraudData);

    logger.fraud('Payment fraud analysis completed', {
      paymentId: fraudData.paymentId,
      userId: fraudData.userId,
      riskScore: analysis.riskScore,
      status: analysis.status
    });

    res.json({
      success: true,
      data: analysis,
      timestamp: new Date().toISOString()
    });
  })
);

// Get fraud detection rules
router.get('/rules',
  authenticateToken,
  requireModerator,
  [
    query('enabled').optional().isBoolean(),
    query('category').optional().isIn(['amount', 'frequency', 'location', 'device', 'behavior']),
    query('severity').optional().isIn(['low', 'medium', 'high', 'critical'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { enabled, category, severity } = req.query;

    // Get fraud detection rules
    const rules = await getFraudDetectionRules({ enabled, category, severity });

    res.json({
      success: true,
      data: rules,
      timestamp: new Date().toISOString()
    });
  })
);

// Create fraud detection rule
router.post('/rules',
  authenticateToken,
  requireAdmin,
  [
    body('name').isString().notEmpty().max(100),
    body('description').isString().max(500),
    body('category').isIn(['amount', 'frequency', 'location', 'device', 'behavior']),
    body('severity').isIn(['low', 'medium', 'high', 'critical']),
    body('conditions').isArray(),
    body('actions').isArray(),
    body('enabled').optional().isBoolean(),
    body('priority').optional().isInt({ min: 1, max: 100 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const ruleData = req.body;

    // Create fraud detection rule
    const rule = await createFraudDetectionRule(ruleData, req.user.id);

    logger.fraud('Fraud detection rule created', {
      ruleId: rule.ruleId,
      name: rule.name,
      category: rule.category,
      severity: rule.severity,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: rule,
      message: 'Fraud detection rule created successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Update fraud detection rule
router.put('/rules/:ruleId',
  authenticateToken,
  requireAdmin,
  [
    param('ruleId').isString().notEmpty(),
    body('name').optional().isString().notEmpty().max(100),
    body('description').optional().isString().max(500),
    body('category').optional().isIn(['amount', 'frequency', 'location', 'device', 'behavior']),
    body('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
    body('conditions').optional().isArray(),
    body('actions').optional().isArray(),
    body('enabled').optional().isBoolean(),
    body('priority').optional().isInt({ min: 1, max: 100 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { ruleId } = req.params;
    const updateData = req.body;

    // Update fraud detection rule
    const rule = await updateFraudDetectionRule(ruleId, updateData, req.user.id);

    logger.fraud('Fraud detection rule updated', {
      ruleId,
      updatedBy: req.user.id,
      changes: Object.keys(updateData)
    });

    res.json({
      success: true,
      data: rule,
      message: 'Fraud detection rule updated successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Delete fraud detection rule
router.delete('/rules/:ruleId',
  authenticateToken,
  requireAdmin,
  [
    param('ruleId').isString().notEmpty()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { ruleId } = req.params;

    // Delete fraud detection rule
    await deleteFraudDetectionRule(ruleId, req.user.id);

    logger.fraud('Fraud detection rule deleted', {
      ruleId,
      deletedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Fraud detection rule deleted successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Get fraud alerts
router.get('/alerts',
  authenticateToken,
  requireModerator,
  [
    query('status').optional().isIn(['open', 'investigating', 'resolved', 'false_positive']),
    query('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
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
      status,
      severity,
      startDate,
      endDate,
      limit = 20,
      offset = 0
    } = req.query;

    // Get fraud alerts
    const alerts = await getFraudAlerts({
      status,
      severity,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: alerts,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: alerts.length
      },
      timestamp: new Date().toISOString()
    });
  })
);

// Update fraud alert status
router.put('/alerts/:alertId',
  authenticateToken,
  requireModerator,
  [
    param('alertId').isString().notEmpty(),
    body('status').isIn(['open', 'investigating', 'resolved', 'false_positive']),
    body('notes').optional().isString().max(1000),
    body('assignedTo').optional().isString()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { alertId } = req.params;
    const updateData = req.body;

    // Update fraud alert status
    const alert = await updateFraudAlertStatus(alertId, updateData, req.user.id);

    logger.fraud('Fraud alert status updated', {
      alertId,
      status: updateData.status,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: alert,
      message: 'Fraud alert status updated successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Get fraud detection statistics
router.get('/stats/overview',
  authenticateToken,
  requireModerator,
  [
    query('period').optional().isIn(['hour', 'day', 'week', 'month', 'year']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { period = 'day', startDate, endDate } = req.query;

    // Get fraud detection statistics
    const stats = await getFraudDetectionStatistics({ period, startDate, endDate });

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  })
);

// Admin: Update fraud detection configuration
router.put('/config',
  authenticateToken,
  requireAdmin,
  [
    body('enabled').optional().isBoolean(),
    body('autoBlock').optional().isBoolean(),
    body('riskThresholds').optional().isObject(),
    body('notificationSettings').optional().isObject(),
    body('updateInterval').optional().isInt({ min: 60000, max: 3600000 }) // 1 minute to 1 hour
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const configData = req.body;

    // Update fraud detection configuration
    const config = await updateFraudDetectionConfig(configData);

    logger.fraud('Fraud detection configuration updated', {
      updatedBy: req.user.id,
      changes: Object.keys(configData)
    });

    res.json({
      success: true,
      data: config,
      message: 'Fraud detection configuration updated successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Helper functions
async function analyzePaymentForFraud(fraudData) {
  // This would implement actual fraud analysis logic
  // For now, return mock data
  const riskScore = Math.random() * 100;
  let status = 'approved';
  let riskLevel = 'low';

  if (riskScore > 80) {
    status = 'blocked';
    riskLevel = 'critical';
  } else if (riskScore > 60) {
    status = 'review';
    riskLevel = 'high';
  } else if (riskScore > 30) {
    status = 'approved';
    riskLevel = 'medium';
  }

  return {
    paymentId: fraudData.paymentId,
    userId: fraudData.userId,
    riskScore: parseFloat(riskScore.toFixed(2)),
    riskLevel,
    status,
    factors: [
      'amount_threshold',
      'frequency_check',
      'location_analysis',
      'device_fingerprint'
    ],
    recommendations: [
      'Monitor user activity',
      'Enable additional verification'
    ],
    analyzedAt: new Date().toISOString()
  };
}

async function getFraudDetectionRules(filters) {
  // This would query the database for fraud detection rules
  // For now, return mock data
  return [
    {
      ruleId: 'rule_1',
      name: 'High Amount Threshold',
      description: 'Block payments above threshold',
      category: 'amount',
      severity: 'high',
      conditions: [
        { field: 'amount', operator: 'gt', value: 10000 }
      ],
      actions: ['block', 'notify'],
      enabled: true,
      priority: 1,
      createdAt: new Date().toISOString()
    }
  ];
}

async function createFraudDetectionRule(ruleData, userId) {
  // This would implement rule creation logic
  // For now, return mock data
  return {
    ruleId: `rule_${Date.now()}`,
    name: ruleData.name,
    description: ruleData.description,
    category: ruleData.category,
    severity: ruleData.severity,
    conditions: ruleData.conditions,
    actions: ruleData.actions,
    enabled: ruleData.enabled !== undefined ? ruleData.enabled : true,
    priority: ruleData.priority || 50,
    createdBy: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

async function updateFraudDetectionRule(ruleId, updateData, userId) {
  // This would implement rule update logic
  // For now, return mock data
  return {
    ruleId,
    ...updateData,
    updatedBy: userId,
    updatedAt: new Date().toISOString()
  };
}

async function deleteFraudDetectionRule(ruleId, userId) {
  // This would implement rule deletion logic
  // For now, return success
  return true;
}

async function getFraudAlerts(filters) {
  // This would query the database for fraud alerts
  // For now, return mock data
  return [
    {
      alertId: 'alert_1',
      paymentId: 'payment_123',
      userId: 'user_123',
      ruleId: 'rule_1',
      severity: 'high',
      status: 'open',
      riskScore: 85.5,
      description: 'High risk payment detected',
      createdAt: new Date().toISOString(),
      assignedTo: null
    }
  ];
}

async function updateFraudAlertStatus(alertId, updateData, userId) {
  // This would implement alert status update logic
  // For now, return mock data
  return {
    alertId,
    status: updateData.status,
    notes: updateData.notes,
    assignedTo: updateData.assignedTo,
    updatedBy: userId,
    updatedAt: new Date().toISOString()
  };
}

async function getFraudDetectionStatistics(filters) {
  // This would aggregate fraud detection statistics from the database
  // For now, return mock data
  return {
    period: filters.period,
    totalAlerts: 150,
    openAlerts: 30,
    resolvedAlerts: 100,
    falsePositives: 20,
    bySeverity: {
      low: 20,
      medium: 50,
      high: 60,
      critical: 20
    },
    byStatus: {
      open: 30,
      investigating: 20,
      resolved: 100,
      false_positive: 20
    },
    averageResolutionTime: '2.5 hours'
  };
}

async function updateFraudDetectionConfig(configData) {
  // This would update fraud detection configuration in the database
  // For now, return mock data
  return {
    enabled: configData.enabled !== undefined ? configData.enabled : true,
    autoBlock: configData.autoBlock !== undefined ? configData.autoBlock : false,
    riskThresholds: configData.riskThresholds || {
      low: 30,
      medium: 60,
      high: 80,
      critical: 90
    },
    notificationSettings: configData.notificationSettings || {
      email: true,
      sms: false,
      webhook: true
    },
    updateInterval: configData.updateInterval || 300000, // 5 minutes
    updatedAt: new Date().toISOString()
  };
}

module.exports = router;
