const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { authenticateToken, requireOwnership, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const transactionService = require('../services/transactionService');
const logger = require('../utils/logger');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array()
    });
  }
  next();
};

// Create a new transaction
router.post('/', [
  body('type')
    .isIn(['transfer', 'withdrawal', 'deposit', 'generation', 'fee', 'refund', 'exchange'])
    .withMessage('Invalid transaction type'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('currency')
    .isLength({ min: 3, max: 3 })
    .isUppercase()
    .withMessage('Currency must be a 3-letter uppercase code'),
  body('sourceWalletId')
    .notEmpty()
    .withMessage('Source wallet ID is required'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('reference')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Reference must be less than 100 characters'),
  validateRequest
], asyncHandler(async (req, res) => {
  const transactionData = {
    ...req.body,
    userId: req.user.id
  };

  const transaction = await transactionService.createTransaction(transactionData);

  res.status(201).json({
    message: 'Transaction created successfully',
    transaction: {
      transactionId: transaction.transactionId,
      type: transaction.type,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      feeAmount: transaction.feeAmount,
      netAmount: transaction.netAmount,
      createdAt: transaction.createdAt
    }
  });
}));

// Get user's transactions
router.get('/', [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(['pending', 'processing', 'completed', 'failed', 'cancelled', 'reversed'])
    .withMessage('Invalid status filter'),
  query('type')
    .optional()
    .isIn(['transfer', 'withdrawal', 'deposit', 'generation', 'fee', 'refund', 'exchange'])
    .withMessage('Invalid type filter'),
  query('currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .isUppercase()
    .withMessage('Invalid currency format'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO date'),
  validateRequest
], asyncHandler(async (req, res) => {
  const options = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 20,
    status: req.query.status,
    type: req.query.type,
    currency: req.query.currency,
    startDate: req.query.startDate,
    endDate: req.query.endDate
  };

  const result = await transactionService.getUserTransactions(req.user.id, options);

  res.json({
    message: 'Transactions retrieved successfully',
    ...result
  });
}));

// Get specific transaction
router.get('/:transactionId', [
  param('transactionId')
    .notEmpty()
    .withMessage('Transaction ID is required'),
  validateRequest
], asyncHandler(async (req, res) => {
  const transaction = await transactionService.getTransaction(req.params.transactionId);

  // Check ownership (unless admin)
  if (transaction.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Access denied to this transaction',
      code: 'TRANSACTION_ACCESS_DENIED'
    });
  }

  res.json({
    message: 'Transaction retrieved successfully',
    transaction
  });
}));

// Process a transaction
router.post('/:transactionId/process', [
  param('transactionId')
    .notEmpty()
    .withMessage('Transaction ID is required'),
  body('options')
    .optional()
    .isObject()
    .withMessage('Options must be an object'),
  validateRequest
], asyncHandler(async (req, res) => {
  const transaction = await transactionService.getTransaction(req.params.transactionId);

  // Check ownership (unless admin)
  if (transaction.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Access denied to this transaction',
      code: 'TRANSACTION_ACCESS_DENIED'
    });
  }

  const processedTransaction = await transactionService.processTransaction(
    req.params.transactionId,
    req.body.options || {}
  );

  res.json({
    message: 'Transaction processed successfully',
    transaction: {
      transactionId: processedTransaction.transactionId,
      status: processedTransaction.status,
      processingTime: processedTransaction.processingTime,
      completedAt: processedTransaction.completedAt
    }
  });
}));

// Cancel a transaction
router.post('/:transactionId/cancel', [
  param('transactionId')
    .notEmpty()
    .withMessage('Transaction ID is required'),
  validateRequest
], asyncHandler(async (req, res) => {
  const cancelledTransaction = await transactionService.cancelTransaction(
    req.params.transactionId,
    req.user.id
  );

  res.json({
    message: 'Transaction cancelled successfully',
    transaction: {
      transactionId: cancelledTransaction.transactionId,
      status: cancelledTransaction.status,
      cancelledAt: cancelledTransaction.updatedAt
    }
  });
}));

// Retry a failed transaction
router.post('/:transactionId/retry', [
  param('transactionId')
    .notEmpty()
    .withMessage('Transaction ID is required'),
  validateRequest
], asyncHandler(async (req, res) => {
  const retriedTransaction = await transactionService.retryTransaction(
    req.params.transactionId,
    req.user.id
  );

  res.json({
    message: 'Transaction retry initiated successfully',
    transaction: {
      transactionId: retriedTransaction.transactionId,
      status: retriedTransaction.status,
      retryCount: retriedTransaction.retryCount
    }
  });
}));

// Get transaction status
router.get('/:transactionId/status', [
  param('transactionId')
    .notEmpty()
    .withMessage('Transaction ID is required'),
  validateRequest
], asyncHandler(async (req, res) => {
  const transaction = await transactionService.getTransaction(req.params.transactionId);

  // Check ownership (unless admin)
  if (transaction.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Access denied to this transaction',
      code: 'TRANSACTION_ACCESS_DENIED'
    });
  }

  res.json({
    message: 'Transaction status retrieved successfully',
    status: {
      transactionId: transaction.transactionId,
      status: transaction.status,
      createdAt: transaction.createdAt,
      processedAt: transaction.processedAt,
      completedAt: transaction.completedAt,
      processingTime: transaction.processingTime,
      retryCount: transaction.retryCount,
      maxRetries: transaction.maxRetries,
      canRetry: transaction.canRetry(),
      isExpired: transaction.isExpired,
      ageInMinutes: transaction.ageInMinutes
    }
  });
}));

// Bulk transaction operations (admin only)
router.post('/bulk/process', [
  requireAdmin,
  body('transactionIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('Transaction IDs must be an array with 1-100 items'),
  body('transactionIds.*')
    .notEmpty()
    .withMessage('Each transaction ID must not be empty'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { transactionIds } = req.body;
  const results = [];

  for (const transactionId of transactionIds) {
    try {
      const transaction = await transactionService.processTransaction(transactionId);
      results.push({
        transactionId,
        status: 'success',
        result: transaction.status
      });
    } catch (error) {
      results.push({
        transactionId,
        status: 'failed',
        error: error.message
      });
    }
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const failureCount = results.filter(r => r.status === 'failed').length;

  res.json({
    message: 'Bulk processing completed',
    summary: {
      total: transactionIds.length,
      success: successCount,
      failed: failureCount
    },
    results
  });
}));

// Get transaction statistics
router.get('/stats/overview', [
  query('period')
    .optional()
    .isIn(['day', 'week', 'month', 'year'])
    .withMessage('Period must be day, week, month, or year'),
  validateRequest
], asyncHandler(async (req, res) => {
  const period = req.query.period || 'month';
  const stats = await transactionService.getUserTransactions(req.user.id, { period });

  res.json({
    message: 'Transaction statistics retrieved successfully',
    period,
    stats
  });
}));

// Get transaction details for compliance
router.get('/:transactionId/compliance', [
  requireAdmin,
  param('transactionId')
    .notEmpty()
    .withMessage('Transaction ID is required'),
  validateRequest
], asyncHandler(async (req, res) => {
  const transaction = await transactionService.getTransaction(req.params.transactionId);

  const complianceInfo = {
    transactionId: transaction.transactionId,
    userId: transaction.userId,
    type: transaction.type,
    amount: transaction.amount,
    currency: transaction.currency,
    complianceStatus: transaction.complianceStatus,
    kycLevel: transaction.kycLevel,
    riskScore: transaction.riskScore,
    flags: transaction.flags,
    metadata: transaction.metadata,
    createdAt: transaction.createdAt,
    processedAt: transaction.processedAt
  };

  res.json({
    message: 'Compliance information retrieved successfully',
    complianceInfo
  });
}));

// Update transaction compliance status (admin only)
router.put('/:transactionId/compliance', [
  requireAdmin,
  param('transactionId')
    .notEmpty()
    .withMessage('Transaction ID is required'),
  body('complianceStatus')
    .isIn(['pending', 'approved', 'rejected', 'flagged'])
    .withMessage('Invalid compliance status'),
  body('riskScore')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Risk score must be between 0 and 100'),
  body('flags')
    .optional()
    .isArray()
    .withMessage('Flags must be an array'),
  body('flags.*')
    .optional()
    .isIn(['suspicious', 'high_value', 'unusual_pattern', 'sanctions', 'pep'])
    .withMessage('Invalid flag value'),
  validateRequest
], asyncHandler(async (req, res) => {
  const transaction = await transactionService.getTransaction(req.params.transactionId);

  // Update compliance fields
  transaction.complianceStatus = req.body.complianceStatus;
  if (req.body.riskScore !== undefined) {
    transaction.riskScore = req.body.riskScore;
  }
  if (req.body.flags !== undefined) {
    transaction.flags = req.body.flags;
  }

  await transaction.save();

  // Publish compliance update event
  await transactionService.publishTransactionEvent('compliance_updated', transaction);

  res.json({
    message: 'Transaction compliance status updated successfully',
    transaction: {
      transactionId: transaction.transactionId,
      complianceStatus: transaction.complianceStatus,
      riskScore: transaction.riskScore,
      flags: transaction.flags,
      updatedAt: transaction.updatedAt
    }
  });
}));

// Export transaction data (admin only)
router.get('/export/data', [
  requireAdmin,
  query('startDate')
    .isISO8601()
    .withMessage('Start date must be a valid ISO date'),
  query('endDate')
    .isISO8601()
    .withMessage('End date must be a valid ISO date'),
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('Format must be json or csv'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { startDate, endDate, format = 'json' } = req.query;

  // Get transactions in date range
  const transactions = await transactionService.getUserTransactions(null, {
    startDate,
    endDate,
    limit: 10000 // Large limit for export
  });

  if (format === 'csv') {
    // Convert to CSV format
    const csvData = this.convertToCSV(transactions.transactions);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="transactions_${startDate}_${endDate}.csv"`);
    res.send(csvData);
  } else {
    res.json({
      message: 'Transaction data exported successfully',
      exportInfo: {
        startDate,
        endDate,
        totalTransactions: transactions.transactions.length,
        format
      },
      data: transactions.transactions
    });
  }
}));

// Helper method to convert transactions to CSV
function convertToCSV(transactions) {
  const headers = [
    'Transaction ID',
    'User ID',
    'Type',
    'Amount',
    'Currency',
    'Status',
    'Fee Amount',
    'Net Amount',
    'Created At',
    'Completed At'
  ];

  const csvRows = [headers.join(',')];

  for (const transaction of transactions) {
    const row = [
      transaction.transactionId,
      transaction.userId,
      transaction.type,
      transaction.amount,
      transaction.currency,
      transaction.status,
      transaction.feeAmount,
      transaction.netAmount,
      transaction.createdAt,
      transaction.completedAt || ''
    ];
    csvRows.push(row.join(','));
  }

  return csvRows.join('\n');
}

module.exports = router;
