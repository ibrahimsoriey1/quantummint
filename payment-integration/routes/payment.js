const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, requireModerator, requireKYCLevel, requireVerification } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');

// Create a new payment
router.post('/create',
  authenticateToken,
  requireVerification,
  [
    body('amount').isFloat({ min: 0.01 }),
    body('currency').isIn(['USD', 'EUR', 'GBP', 'XOF', 'XAF']),
    body('provider').isIn(['stripe', 'orange-money', 'afrimoney']),
    body('paymentMethod').isString().notEmpty(),
    body('description').optional().isString().max(500),
    body('metadata').optional().isObject(),
    body('redirectUrl').optional().isURL(),
    body('webhookUrl').optional().isURL()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const paymentData = req.body;
    
    // Create payment
    const payment = await createPayment(paymentData, req.user.id);

    logger.payment('Payment created successfully', {
      paymentId: payment.paymentId,
      userId: req.user.id,
      amount: payment.amount,
      currency: payment.currency,
      provider: payment.provider
    });

    res.status(201).json({
      success: true,
      data: payment,
      message: 'Payment created successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Stripe: create PaymentIntent and return clientSecret
router.post('/intent',
  authenticateToken,
  [
    body('currency').optional().isString().isLength({ min: 3, max: 4 })
  ],
  asyncHandler(async (req, res) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(400).json({ error: 'Stripe not configured' });
    }
    const currency = (req.body.currency || 'usd').toLowerCase();
    const intent = await stripe.paymentIntents.create({ amount: 1000, currency, metadata: { userId: req.user.id } });
    res.json({ clientSecret: intent.client_secret });
  })
);

// Orange Money
router.post('/orange-money',
  authenticateToken,
  [
    body('phone').isString().notEmpty(),
    body('amount').isFloat({ min: 0.1 }),
    body('currency').isString().notEmpty()
  ],
  asyncHandler(async (req, res) => {
    const { phone, amount, currency } = req.body;
    // TODO: integrate Orange Money SDK/API here
    res.json({ status: 'pending', provider: 'orange-money', phone, amount, currency });
  })
);

// AfriMoney
router.post('/afrimoney',
  authenticateToken,
  [
    body('phone').isString().notEmpty(),
    body('amount').isFloat({ min: 0.1 }),
    body('currency').isString().notEmpty()
  ],
  asyncHandler(async (req, res) => {
    const { phone, amount, currency } = req.body;
    // TODO: integrate AfriMoney API here
    res.json({ status: 'pending', provider: 'afrimoney', phone, amount, currency });
  })
);

// Get payment by ID
router.get('/:paymentId',
  authenticateToken,
  [
    param('paymentId').isString().notEmpty()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { paymentId } = req.params;
    
    // Get payment details
    const payment = await getPayment(paymentId, req.user.id);

    res.json({
      success: true,
      data: payment,
      timestamp: new Date().toISOString()
    });
  })
);

// Get user's payment history
router.get('/user/:userId',
  authenticateToken,
  [
    param('userId').isString().notEmpty(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['pending', 'processing', 'completed', 'failed', 'cancelled']),
    query('provider').optional().isIn(['stripe', 'orange-money', 'afrimoney']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { page = 1, limit = 20, status, provider, startDate, endDate } = req.query;
    
    // Check if user can access this data
    if (req.user.role !== 'admin' && req.user.role !== 'moderator' && req.user.id !== userId) {
      return res.status(403).json({
        error: 'Access denied to this user\'s payments',
        code: 'ACCESS_DENIED'
      });
    }
    
    // Get user's payment history
    const paymentHistory = await getUserPaymentHistory(
      userId,
      { page, limit, status, provider, startDate, endDate }
    );

    res.json({
      success: true,
      data: paymentHistory,
      timestamp: new Date().toISOString()
    });
  })
);

// Process payment
router.post('/:paymentId/process',
  authenticateToken,
  requireVerification,
  [
    param('paymentId').isString().notEmpty(),
    body('paymentToken').optional().isString(),
    body('paymentMethodData').optional().isObject()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { paymentId } = req.params;
    const { paymentToken, paymentMethodData } = req.body;
    
    // Process payment
    const result = await processPayment(paymentId, { paymentToken, paymentMethodData }, req.user.id);

    logger.payment('Payment processed', {
      paymentId,
      userId: req.user.id,
      status: result.status,
      provider: result.provider
    });

    res.json({
      success: true,
      data: result,
      message: 'Payment processed successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Cancel payment
router.post('/:paymentId/cancel',
  authenticateToken,
  [
    param('paymentId').isString().notEmpty(),
    body('reason').optional().isString().max(200)
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { paymentId } = req.params;
    const { reason } = req.body;
    
    // Cancel payment
    const result = await cancelPayment(paymentId, reason, req.user.id);

    logger.payment('Payment cancelled', {
      paymentId,
      userId: req.user.id,
      reason
    });

    res.json({
      success: true,
      data: result,
      message: 'Payment cancelled successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Refund payment
router.post('/:paymentId/refund',
  authenticateToken,
  requireModerator,
  [
    param('paymentId').isString().notEmpty(),
    body('amount').isFloat({ min: 0.01 }),
    body('reason').isString().max(200),
    body('metadata').optional().isObject()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { paymentId } = req.params;
    const { amount, reason, metadata } = req.body;
    
    // Process refund
    const refund = await processRefund(paymentId, { amount, reason, metadata }, req.user.id);

    logger.payment('Refund processed', {
      paymentId,
      refundId: refund.refundId,
      amount,
      reason,
      processedBy: req.user.id
    });

    res.json({
      success: true,
      data: refund,
      message: 'Refund processed successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Get payment status
router.get('/:paymentId/status',
  authenticateToken,
  [
    param('paymentId').isString().notEmpty()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { paymentId } = req.params;
    
    // Get payment status
    const status = await getPaymentStatus(paymentId, req.user.id);

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  })
);

// Admin: Get all payments
router.get('/',
  authenticateToken,
  requireModerator,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['pending', 'processing', 'completed', 'failed', 'cancelled']),
    query('provider').optional().isIn(['stripe', 'orange-money', 'afrimoney']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('minAmount').optional().isFloat({ min: 0 }),
    query('maxAmount').optional().isFloat({ min: 0 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      page = 1, 
      limit = 20, 
      status, 
      provider, 
      startDate, 
      endDate,
      minAmount,
      maxAmount
    } = req.query;
    
    // Get all payments with filters
    const payments = await getAllPayments({
      page, limit, status, provider, startDate, endDate, minAmount, maxAmount
    });

    res.json({
      success: true,
      data: payments,
      timestamp: new Date().toISOString()
    });
  })
);

// Admin: Update payment
router.put('/:paymentId',
  authenticateToken,
  requireAdmin,
  [
    param('paymentId').isString().notEmpty(),
    body('status').optional().isIn(['pending', 'processing', 'completed', 'failed', 'cancelled']),
    body('metadata').optional().isObject(),
    body('notes').optional().isString().max(500)
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { paymentId } = req.params;
    const updateData = req.body;
    
    // Update payment
    const updatedPayment = await updatePayment(paymentId, updateData, req.user.id);

    logger.payment('Payment updated by admin', {
      paymentId,
      adminId: req.user.id,
      updates: updateData
    });

    res.json({
      success: true,
      data: updatedPayment,
      message: 'Payment updated successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Admin: Export payments
router.get('/export',
  authenticateToken,
  requireAdmin,
  [
    query('format').optional().isIn(['csv', 'json', 'xlsx']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('status').optional().isIn(['pending', 'processing', 'completed', 'failed', 'cancelled']),
    query('provider').optional().isIn(['stripe', 'orange-money', 'afrimoney'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      format = 'csv', 
      startDate, 
      endDate, 
      status, 
      provider 
    } = req.query;
    
    // Export payments data
    const exportData = await exportPayments({ 
      format, startDate, endDate, status, provider 
    });

    // Set appropriate headers for file download
    res.setHeader('Content-Type', getContentType(format));
    res.setHeader('Content-Disposition', `attachment; filename="payments_${Date.now()}.${format}"`);
    
    res.send(exportData);
  })
);

// Helper functions
async function createPayment(paymentData, userId) {
  try {
    // This would implement payment creation logic
    // For now, return mock data
    const paymentId = `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    return {
      paymentId,
      userId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      provider: paymentData.provider,
      status: 'pending',
      createdAt: new Date().toISOString(),
      ...paymentData
    };
  } catch (error) {
    logger.error('Error creating payment:', error);
    throw error;
  }
}

async function getPayment(paymentId, userId) {
  try {
    // This would implement payment retrieval logic
    // For now, return mock data
    return {
      paymentId,
      userId,
      amount: 100.00,
      currency: 'USD',
      provider: 'stripe',
      status: 'completed',
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error getting payment:', error);
    throw error;
  }
}

async function getUserPaymentHistory(userId, options) {
  try {
    // This would implement payment history retrieval logic
    // For now, return mock data
    return {
      payments: [],
      pagination: {
        page: parseInt(options.page),
        limit: parseInt(options.limit),
        total: 0,
        pages: 0
      }
    };
  } catch (error) {
    logger.error('Error getting user payment history:', error);
    throw error;
  }
}

async function processPayment(paymentId, paymentData, userId) {
  try {
    // This would implement payment processing logic
    // For now, return mock data
    return {
      paymentId,
      status: 'processing',
      provider: 'stripe',
      processedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error processing payment:', error);
    throw error;
  }
}

async function cancelPayment(paymentId, reason, userId) {
  try {
    // This would implement payment cancellation logic
    // For now, return mock data
    return {
      paymentId,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      reason
    };
  } catch (error) {
    logger.error('Error cancelling payment:', error);
    throw error;
  }
}

async function processRefund(paymentId, refundData, userId) {
  try {
    // This would implement refund processing logic
    // For now, return mock data
    const refundId = `REF_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    return {
      refundId,
      paymentId,
      amount: refundData.amount,
      reason: refundData.reason,
      status: 'completed',
      processedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error processing refund:', error);
    throw error;
  }
}

async function getPaymentStatus(paymentId, userId) {
  try {
    // This would implement payment status retrieval logic
    // For now, return mock data
    return {
      paymentId,
      status: 'completed',
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error getting payment status:', error);
    throw error;
  }
}

async function getAllPayments(options) {
  try {
    // This would implement payment retrieval with filters logic
    // For now, return mock data
    return {
      payments: [],
      pagination: {
        page: parseInt(options.page),
        limit: parseInt(options.limit),
        total: 0,
        pages: 0
      }
    };
  } catch (error) {
    logger.error('Error getting all payments:', error);
    throw error;
  }
}

async function updatePayment(paymentId, updateData, adminId) {
  try {
    // This would implement payment update logic
    // For now, return mock data
    return {
      paymentId,
      ...updateData,
      updatedAt: new Date().toISOString(),
      updatedBy: adminId
    };
  } catch (error) {
    logger.error('Error updating payment:', error);
    throw error;
  }
}

async function exportPayments(options) {
  try {
    // This would implement payment export logic
    // For now, return mock CSV data
    return 'PaymentId,UserId,Amount,Currency,Provider,Status,CreatedAt\n';
  } catch (error) {
    logger.error('Error exporting payments:', error);
    throw error;
  }
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
