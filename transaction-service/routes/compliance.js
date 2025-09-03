const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, requireModerator, requireKYCLevel } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// Perform compliance check for a transaction
router.post('/check',
  authenticateToken,
  [
    body('transactionId').isString().notEmpty(),
    body('userId').isString().notEmpty(),
    body('amount').isFloat({ min: 0 }),
    body('currency').isIn(['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD']),
    body('transactionType').isIn(['transfer', 'withdrawal', 'deposit', 'generation', 'exchange']),
    body('sourceWalletId').isString().notEmpty(),
    body('destinationWalletId').optional().isString(),
    body('destinationAddress').optional().isString()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const complianceData = req.body;
    
    // Perform comprehensive compliance check
    const complianceResult = await performComplianceCheck(complianceData, req.user.id);

    logger.compliance('Compliance check performed', {
      transactionId: complianceData.transactionId,
      userId: complianceData.userId,
      result: complianceResult.approved ? 'approved' : 'rejected',
      reason: complianceResult.reason
    });

    res.json({
      success: true,
      data: complianceResult,
      timestamp: new Date().toISOString()
    });
  })
);

// Get compliance status for a transaction
router.get('/status/:transactionId',
  authenticateToken,
  [
    param('transactionId').isString().notEmpty()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { transactionId } = req.params;
    
    // Get compliance status
    const complianceStatus = await getComplianceStatus(transactionId, req.user.id);

    res.json({
      success: true,
      data: complianceStatus,
      timestamp: new Date().toISOString()
    });
  })
);

// Get user's compliance profile
router.get('/profile',
  authenticateToken,
  asyncHandler(async (req, res) => {
    // Get user's compliance profile
    const complianceProfile = await getUserComplianceProfile(req.user.id);

    res.json({
      success: true,
      data: complianceProfile,
      timestamp: new Date().toISOString()
    });
  })
);

// Get user's compliance history
router.get('/history',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('status').optional().isIn(['approved', 'rejected', 'flagged', 'pending']),
    query('type').optional().isIn(['kyc', 'aml', 'sanctions', 'pep', 'pattern'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { page = 1, limit = 20, startDate, endDate, status, type } = req.query;
    
    // Get user's compliance history
    const complianceHistory = await getUserComplianceHistory(
      req.user.id,
      { page, limit, startDate, endDate, status, type }
    );

    res.json({
      success: true,
      data: complianceHistory,
      timestamp: new Date().toISOString()
    });
  })
);

// Admin: Get system-wide compliance statistics
router.get('/statistics',
  authenticateToken,
  requireModerator,
  [
    query('period').optional().isIn(['day', 'week', 'month', 'year']),
    query('type').optional().isIn(['kyc', 'aml', 'sanctions', 'pep', 'pattern'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { period = 'month', type } = req.query;
    
    // Get system-wide compliance statistics
    const complianceStats = await getSystemComplianceStatistics(period, type);

    res.json({
      success: true,
      data: complianceStats,
      timestamp: new Date().toISOString()
    });
  })
);

// Admin: Get flagged transactions
router.get('/flagged',
  authenticateToken,
  requireModerator,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['pending', 'reviewed', 'resolved']),
    query('priority').optional().isIn(['low', 'medium', 'high', 'critical'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { page = 1, limit = 20, status, priority } = req.query;
    
    // Get flagged transactions
    const flaggedTransactions = await getFlaggedTransactions(
      { page, limit, status, priority }
    );

    res.json({
      success: true,
      data: flaggedTransactions,
      timestamp: new Date().toISOString()
    });
  })
);

// Admin: Review flagged transaction
router.post('/review/:transactionId',
  authenticateToken,
  requireModerator,
  [
    param('transactionId').isString().notEmpty(),
    body('action').isIn(['approve', 'reject', 'flag', 'escalate']),
    body('reason').isString().notEmpty(),
    body('notes').optional().isString(),
    body('priority').optional().isIn(['low', 'medium', 'high', 'critical'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { transactionId } = req.params;
    const { action, reason, notes, priority } = req.body;
    
    // Review flagged transaction
    const reviewResult = await reviewFlaggedTransaction(
      transactionId,
      action,
      reason,
      notes,
      priority,
      req.user.id
    );

    logger.compliance('Flagged transaction reviewed', {
      transactionId,
      reviewerId: req.user.id,
      action,
      reason
    });

    res.json({
      success: true,
      data: reviewResult,
      message: 'Transaction reviewed successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Admin: Update compliance rules
router.put('/rules',
  authenticateToken,
  requireAdmin,
  [
    body('ruleType').isIn(['kyc', 'aml', 'sanctions', 'pep', 'pattern']),
    body('ruleName').isString().notEmpty(),
    body('ruleConfig').isObject(),
    body('enabled').isBoolean(),
    body('priority').optional().isIn(['low', 'medium', 'high', 'critical'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const ruleUpdate = req.body;
    
    // Update compliance rule
    const updatedRule = await updateComplianceRule(ruleUpdate, req.user.id);

    logger.compliance('Compliance rule updated', {
      adminId: req.user.id,
      ruleType: ruleUpdate.ruleType,
      ruleName: ruleUpdate.ruleName,
      enabled: ruleUpdate.enabled
    });

    res.json({
      success: true,
      data: updatedRule,
      message: 'Compliance rule updated successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Admin: Get compliance rules
router.get('/rules',
  authenticateToken,
  requireModerator,
  [
    query('type').optional().isIn(['kyc', 'aml', 'sanctions', 'pep', 'pattern']),
    query('enabled').optional().isBoolean()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { type, enabled } = req.query;
    
    // Get compliance rules
    const complianceRules = await getComplianceRules(type, enabled);

    res.json({
      success: true,
      data: complianceRules,
      timestamp: new Date().toISOString()
    });
  })
);

// Admin: Export compliance data
router.get('/export',
  authenticateToken,
  requireAdmin,
  [
    query('format').optional().isIn(['csv', 'json', 'xlsx']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('type').optional().isIn(['kyc', 'aml', 'sanctions', 'pep', 'pattern']),
    query('status').optional().isIn(['approved', 'rejected', 'flagged', 'pending'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { format = 'csv', startDate, endDate, type, status } = req.query;
    
    // Export compliance data
    const exportData = await exportComplianceData({ format, startDate, endDate, type, status });

    // Set appropriate headers for file download
    res.setHeader('Content-Type', getContentType(format));
    res.setHeader('Content-Disposition', `attachment; filename="compliance_data_${Date.now()}.${format}"`);
    
    res.send(exportData);
  })
);

// Helper functions
async function performComplianceCheck(complianceData, requesterId) {
  try {
    // This would integrate with your compliance checking logic
    const {
      transactionId,
      userId,
      amount,
      currency,
      transactionType,
      sourceWalletId,
      destinationWalletId,
      destinationAddress
    } = complianceData;

    // Check KYC level requirements
    let kycRequired = false;
    if (amount > 10000) {
      kycRequired = true;
    }

    // Check for suspicious patterns
    const suspiciousPatterns = await detectSuspiciousPatterns(complianceData);
    
    // Check sanctions and PEP lists
    const sanctionsCheck = await checkSanctionsAndPEP(userId);
    
    // Determine overall compliance status
    let approved = true;
    let reason = null;
    let flags = [];

    if (kycRequired) {
      // This would check actual KYC level from user service
      const userKYCLevel = 'basic'; // Mock data
      if (userKYCLevel !== 'enhanced') {
        approved = false;
        reason = 'Enhanced KYC required for transactions above $10,000';
      }
    }

    if (suspiciousPatterns.length > 0) {
      flags.push(...suspiciousPatterns);
      if (suspiciousPatterns.some(pattern => pattern.includes('critical'))) {
        approved = false;
        reason = 'Critical suspicious activity detected';
      }
    }

    if (!sanctionsCheck.approved) {
      approved = false;
      reason = sanctionsCheck.reason;
    }

    return {
      transactionId,
      userId,
      approved,
      reason,
      flags,
      kycRequired,
      riskScore: calculateRiskScore(complianceData, flags),
      checkedAt: new Date().toISOString(),
      checkedBy: requesterId
    };
  } catch (error) {
    logger.error('Error performing compliance check:', error);
    return {
      approved: false,
      reason: 'Compliance check failed due to system error',
      error: error.message
    };
  }
}

async function getComplianceStatus(transactionId, userId) {
  // This would query the compliance status from database
  // For now, return mock data
  return {
    transactionId,
    status: 'pending',
    lastChecked: new Date().toISOString(),
    nextCheck: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };
}

async function getUserComplianceProfile(userId) {
  // This would get user's compliance profile from database
  // For now, return mock data
  return {
    userId,
    kycLevel: 'basic',
    verificationStatus: 'pending',
    riskScore: 25,
    lastVerified: null,
    complianceHistory: []
  };
}

async function getUserComplianceHistory(userId, options) {
  // This would query user's compliance history from database
  // For now, return mock data
  return {
    history: [],
    pagination: {
      page: parseInt(options.page),
      limit: parseInt(options.limit),
      total: 0,
      pages: 0
    }
  };
}

async function getSystemComplianceStatistics(period, type) {
  // This would calculate system-wide compliance statistics
  // For now, return mock data
  return {
    totalChecks: 0,
    approved: 0,
    rejected: 0,
    flagged: 0,
    period,
    type
  };
}

async function getFlaggedTransactions(options) {
  // This would get flagged transactions from database
  // For now, return mock data
  return {
    transactions: [],
    pagination: {
      page: parseInt(options.page),
      limit: parseInt(options.limit),
      total: 0,
      pages: 0
    }
  };
}

async function reviewFlaggedTransaction(transactionId, action, reason, notes, priority, reviewerId) {
  // This would update the flagged transaction status
  // For now, return mock data
  return {
    transactionId,
    action,
    reason,
    notes,
    priority,
    reviewedBy: reviewerId,
    reviewedAt: new Date().toISOString()
  };
}

async function updateComplianceRule(ruleUpdate, adminId) {
  // This would update compliance rules in database/config
  // For now, return the update
  return {
    ...ruleUpdate,
    updatedBy: adminId,
    updatedAt: new Date().toISOString()
  };
}

async function getComplianceRules(type, enabled) {
  // This would return compliance rules from database/config
  // For now, return mock data
  return [
    {
      ruleType: 'kyc',
      ruleName: 'Enhanced KYC for High Amounts',
      enabled: true,
      priority: 'high'
    }
  ];
}

async function exportComplianceData(options) {
  // This would export compliance data in the specified format
  // For now, return mock CSV data
  return 'TransactionId,UserId,Status,Reason,Flags,CheckedAt\n';
}

async function detectSuspiciousPatterns(complianceData) {
  const patterns = [];
  
  try {
    const { amount, currency, transactionType } = complianceData;
    
    // Check for unusual transaction amounts
    if (amount > 100000) {
      patterns.push('Unusually high amount');
    }
    
    // Check for round amounts (potential money laundering indicator)
    if (amount % 1000 === 0 && amount > 10000) {
      patterns.push('Suspicious round amount');
    }
    
    // Check for rapid successive transactions (would need transaction history)
    // This is a placeholder for the actual logic
    
  } catch (error) {
    logger.error('Error detecting suspicious patterns:', error);
  }
  
  return patterns;
}

async function checkSanctionsAndPEP(userId) {
  try {
    // This would integrate with external sanctions checking services
    // For now, return a basic check
    
    // Check if user is in any known sanctions lists
    const sanctionsCheck = await checkUserSanctions(userId);
    if (sanctionsCheck.isSanctioned) {
      return {
        approved: false,
        reason: `User is on sanctions list: ${sanctionsCheck.list}`
      };
    }
    
    // Check if user is a Politically Exposed Person (PEP)
    const pepCheck = await checkUserPEP(userId);
    if (pepCheck.isPEP) {
      // PEP transactions require additional scrutiny but are not automatically rejected
      return {
        approved: true,
        reason: 'User identified as PEP - additional monitoring required'
      };
    }
    
    return { approved: true };
  } catch (error) {
    logger.error('Error checking sanctions and PEP:', error);
    return {
      approved: false,
      reason: 'Sanctions check failed due to system error'
    };
  }
}

async function checkUserSanctions(userId) {
  // This would integrate with external sanctions checking services
  return { isSanctioned: false, list: null };
}

async function checkUserPEP(userId) {
  // This would integrate with external PEP checking services
  return { isPEP: false, riskLevel: 'low' };
}

function calculateRiskScore(complianceData, flags) {
  let riskScore = 0;
  
  // Base risk based on amount
  if (complianceData.amount > 100000) {
    riskScore += 30;
  } else if (complianceData.amount > 10000) {
    riskScore += 15;
  }
  
  // Risk based on flags
  flags.forEach(flag => {
    if (flag.includes('critical')) {
      riskScore += 50;
    } else if (flag.includes('high')) {
      riskScore += 25;
    } else if (flag.includes('medium')) {
      riskScore += 15;
    } else if (flag.includes('low')) {
      riskScore += 5;
    }
  });
  
  return Math.min(riskScore, 100);
}

function getContentType(format) {
  switch (format) {
    case 'csv':
      return 'text/csv';
    case 'json':
      return 'application/json';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default:
      return 'text/plain';
  }
}

module.exports = router;
