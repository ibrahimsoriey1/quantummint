const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, requireModerator } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// Get fee structure for transactions
router.get('/structure', 
  authenticateToken,
  [
    query('transactionType').optional().isIn(['transfer', 'withdrawal', 'deposit', 'generation', 'exchange']),
    query('currency').optional().isIn(['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD']),
    query('amount').optional().isFloat({ min: 0 }),
    query('userTier').optional().isIn(['basic', 'premium', 'enterprise'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { transactionType, currency, amount, userTier } = req.query;
    
    // Calculate fee structure based on parameters
    const feeStructure = await calculateFeeStructure(transactionType, currency, amount, userTier);
    
    res.json({
      success: true,
      data: feeStructure,
      timestamp: new Date().toISOString()
    });
  })
);

// Calculate fees for a specific transaction
router.post('/calculate',
  authenticateToken,
  [
    body('transactionType').isIn(['transfer', 'withdrawal', 'deposit', 'generation', 'exchange']),
    body('amount').isFloat({ min: 0 }),
    body('currency').isIn(['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD']),
    body('sourceWalletId').isString().notEmpty(),
    body('destinationWalletId').optional().isString(),
    body('destinationAddress').optional().isString(),
    body('userTier').optional().isIn(['basic', 'premium', 'enterprise'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      transactionType,
      amount,
      currency,
      sourceWalletId,
      destinationWalletId,
      destinationAddress,
      userTier
    } = req.body;

    // Calculate fees
    const feeCalculation = await calculateTransactionFees(
      transactionType,
      amount,
      currency,
      userTier,
      req.user.id
    );

    res.json({
      success: true,
      data: feeCalculation,
      timestamp: new Date().toISOString()
    });
  })
);

// Get user's fee history
router.get('/history',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('transactionType').optional().isIn(['transfer', 'withdrawal', 'deposit', 'generation', 'exchange']),
    query('currency').optional().isIn(['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { page = 1, limit = 20, startDate, endDate, transactionType, currency } = req.query;
    
    // Get user's fee history from transactions
    const feeHistory = await getUserFeeHistory(
      req.user.id,
      { page, limit, startDate, endDate, transactionType, currency }
    );

    res.json({
      success: true,
      data: feeHistory,
      timestamp: new Date().toISOString()
    });
  })
);

// Get fee statistics for user
router.get('/statistics',
  authenticateToken,
  [
    query('period').optional().isIn(['day', 'week', 'month', 'year']),
    query('currency').optional().isIn(['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { period = 'month', currency } = req.query;
    
    // Get user's fee statistics
    const feeStats = await getUserFeeStatistics(req.user.id, period, currency);

    res.json({
      success: true,
      data: feeStats,
      timestamp: new Date().toISOString()
    });
  })
);

// Admin: Get system-wide fee statistics
router.get('/system/statistics',
  authenticateToken,
  requireAdmin,
  [
    query('period').optional().isIn(['day', 'week', 'month', 'year']),
    query('currency').optional().isIn(['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { period = 'month', currency } = req.query;
    
    // Get system-wide fee statistics
    const systemFeeStats = await getSystemFeeStatistics(period, currency);

    res.json({
      success: true,
      data: systemFeeStats,
      timestamp: new Date().toISOString()
    });
  })
);

// Admin: Update fee structure
router.put('/structure',
  authenticateToken,
  requireAdmin,
  [
    body('transactionType').isIn(['transfer', 'withdrawal', 'deposit', 'generation', 'exchange']),
    body('currency').isIn(['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD']),
    body('feePercentage').isFloat({ min: 0, max: 100 }),
    body('fixedFee').optional().isFloat({ min: 0 }),
    body('minFee').optional().isFloat({ min: 0 }),
    body('maxFee').optional().isFloat({ min: 0 }),
    body('userTier').optional().isIn(['basic', 'premium', 'enterprise']),
    body('effectiveDate').optional().isISO8601()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const feeUpdate = req.body;
    
    // Update fee structure
    const updatedFeeStructure = await updateFeeStructure(feeUpdate, req.user.id);

    logger.fee('Fee structure updated', {
      adminId: req.user.id,
      transactionType: feeUpdate.transactionType,
      currency: feeUpdate.currency,
      newFeePercentage: feeUpdate.feePercentage
    });

    res.json({
      success: true,
      data: updatedFeeStructure,
      message: 'Fee structure updated successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Admin: Get fee configuration
router.get('/configuration',
  authenticateToken,
  requireModerator,
  asyncHandler(async (req, res) => {
    // Get current fee configuration
    const feeConfig = await getFeeConfiguration();

    res.json({
      success: true,
      data: feeConfig,
      timestamp: new Date().toISOString()
    });
  })
);

// Admin: Export fee data
router.get('/export',
  authenticateToken,
  requireAdmin,
  [
    query('format').optional().isIn(['csv', 'json', 'xlsx']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('transactionType').optional().isIn(['transfer', 'withdrawal', 'deposit', 'generation', 'exchange'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { format = 'csv', startDate, endDate, transactionType } = req.query;
    
    // Export fee data
    const exportData = await exportFeeData({ format, startDate, endDate, transactionType });

    // Set appropriate headers for file download
    res.setHeader('Content-Type', getContentType(format));
    res.setHeader('Content-Disposition', `attachment; filename="fee_data_${Date.now()}.${format}"`);
    
    res.send(exportData);
  })
);

// Helper functions
async function calculateFeeStructure(transactionType, currency, amount, userTier) {
  // This would integrate with your fee calculation logic
  const baseFeePercentage = parseFloat(process.env.TRANSACTION_FEE_PERCENTAGE) || 2.5;
  
  let feePercentage = baseFeePercentage;
  
  // Adjust based on transaction type
  switch (transactionType) {
    case 'transfer':
      feePercentage = baseFeePercentage * 0.5;
      break;
    case 'withdrawal':
      feePercentage = baseFeePercentage * 1.5;
      break;
    case 'deposit':
      feePercentage = 0;
      break;
    case 'generation':
      feePercentage = baseFeePercentage * 0.8;
      break;
    case 'exchange':
      feePercentage = baseFeePercentage * 1.2;
      break;
  }
  
  // Adjust based on user tier
  if (userTier === 'premium') {
    feePercentage *= 0.8;
  } else if (userTier === 'enterprise') {
    feePercentage *= 0.6;
  }
  
  return {
    transactionType,
    currency,
    amount,
    userTier,
    feePercentage,
    feeAmount: (amount * feePercentage) / 100,
    netAmount: amount - ((amount * feePercentage) / 100)
  };
}

async function calculateTransactionFees(transactionType, amount, currency, userTier, userId) {
  // Get user's current tier if not provided
  if (!userTier) {
    // This would fetch from user service
    userTier = 'basic';
  }
  
  const feeStructure = await calculateFeeStructure(transactionType, currency, amount, userTier);
  
  return {
    ...feeStructure,
    userId,
    calculatedAt: new Date().toISOString()
  };
}

async function getUserFeeHistory(userId, options) {
  // This would query the Transaction model for fee history
  // For now, return mock data
  return {
    fees: [],
    pagination: {
      page: parseInt(options.page),
      limit: parseInt(options.limit),
      total: 0,
      pages: 0
    }
  };
}

async function getUserFeeStatistics(userId, period, currency) {
  // This would calculate fee statistics for the user
  // For now, return mock data
  return {
    totalFees: 0,
    averageFee: 0,
    totalTransactions: 0,
    period,
    currency
  };
}

async function getSystemFeeStatistics(period, currency) {
  // This would calculate system-wide fee statistics
  // For now, return mock data
  return {
    totalFees: 0,
    averageFee: 0,
    totalTransactions: 0,
    period,
    currency
  };
}

async function updateFeeStructure(feeUpdate, adminId) {
  // This would update the fee configuration in database/config
  // For now, return the update
  return {
    ...feeUpdate,
    updatedBy: adminId,
    updatedAt: new Date().toISOString()
  };
}

async function getFeeConfiguration() {
  // This would return current fee configuration
  return {
    baseFeePercentage: parseFloat(process.env.TRANSACTION_FEE_PERCENTAGE) || 2.5,
    currencies: ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'],
    transactionTypes: ['transfer', 'withdrawal', 'deposit', 'generation', 'exchange'],
    userTiers: ['basic', 'premium', 'enterprise']
  };
}

async function exportFeeData(options) {
  // This would export fee data in the specified format
  // For now, return mock CSV data
  return 'TransactionId,Type,Amount,Currency,FeeAmount,Date\n';
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
