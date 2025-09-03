const express = require('express');
const { body, query, param } = require('express-validator');
const paymentController = require('../controllers/payment.controller');
const { validateRequest } = require('../middleware/validateRequest');
const { authenticate, authenticateService } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { 
  cacheMiddleware, 
  cacheUserPaymentMethods, 
  clearUserPaymentMethodsCache 
} = require('../config/redis');
const { idempotencyMiddleware } = require('../middleware/idempotency');

const router = express.Router();

// Create payment
router.post(
  '/',
  authenticate,
  idempotencyMiddleware('payment:create', 900),
  [
    body('transactionId')
      .isString()
      .withMessage('Transaction ID is required'),
    body('provider')
      .isIn(['stripe', 'orange_money', 'afrimoney'])
      .withMessage('Invalid provider'),
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be at least 0.01'),
    body('currency')
      .optional()
      .isString()
      .isLength({ min: 3, max: 3 })
      .withMessage('Currency must be a 3-letter code'),
    body('recipientInfo')
      .optional()
      .isObject()
      .withMessage('Recipient info must be an object'),
    validateRequest
  ],
  async (req, res, next) => {
    // Clear user payment methods cache when creating a new payment
    try {
      await clearUserPaymentMethodsCache(req.user.id);
      next();
    } catch (error) {
      next(error);
    }
  },
  paymentController.createPayment
);

// Create withdrawal
router.post(
  '/withdrawal',
  authenticate,
  idempotencyMiddleware('payment:withdrawal', 900),
  [
    body('transactionId')
      .isString()
      .withMessage('Transaction ID is required'),
    body('provider')
      .isIn(['stripe', 'orange_money', 'afrimoney'])
      .withMessage('Invalid provider'),
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be at least 0.01'),
    body('currency')
      .optional()
      .isString()
      .isLength({ min: 3, max: 3 })
      .withMessage('Currency must be a 3-letter code'),
    body('recipientInfo')
      .isObject()
      .withMessage('Recipient info is required'),
    validateRequest
  ],
  async (req, res, next) => {
    // Clear user payment methods cache when creating a withdrawal
    try {
      await clearUserPaymentMethodsCache(req.user.id);
      next();
    } catch (error) {
      next(error);
    }
  },
  paymentController.createWithdrawal
);

// Get payment by ID - cache for 5 minutes (300 seconds)
router.get(
  '/:id',
  authenticate,
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid payment ID'),
    validateRequest
  ],
  cacheMiddleware(300),
  paymentController.getPaymentById
);

// Get payment status - cache for 30 seconds
router.get(
  '/:id/status',
  authenticate,
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid payment ID'),
    validateRequest
  ],
  cacheMiddleware(30),
  paymentController.getPaymentStatus
);

// Get user payments - cache for 2 minutes (120 seconds)
router.get(
  '/',
  authenticate,
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('type')
      .optional()
      .isIn(['payment', 'withdrawal'])
      .withMessage('Invalid payment type'),
    query('provider')
      .optional()
      .isIn(['stripe', 'orange_money', 'afrimoney'])
      .withMessage('Invalid provider'),
    query('status')
      .optional()
      .isIn(['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'])
      .withMessage('Invalid status'),
    validateRequest
  ],
  cacheMiddleware(120),
  paymentController.getUserPayments
);

// Refund payment
router.post(
  '/:id/refund',
  authenticate,
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid payment ID'),
    body('amount')
      .optional()
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be at least 0.01'),
    body('reason')
      .optional()
      .isString()
      .withMessage('Reason must be a string'),
    validateRequest
  ],
  async (req, res, next) => {
    // Clear user payment methods cache when refunding a payment
    try {
      await clearUserPaymentMethodsCache(req.user.id);
      next();
    } catch (error) {
      next(error);
    }
  },
  paymentController.refundPayment
);

// Cancel payment
router.post(
  '/:id/cancel',
  authenticate,
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid payment ID'),
    body('reason')
      .optional()
      .isString()
      .withMessage('Reason must be a string'),
    validateRequest
  ],
  async (req, res, next) => {
    // Clear user payment methods cache when cancelling a payment
    try {
      await clearUserPaymentMethodsCache(req.user.id);
      next();
    } catch (error) {
      next(error);
    }
  },
  paymentController.cancelPayment
);

// Internal routes (service to service)
// Create internal payment
router.post(
  '/internal',
  authenticateService,
  [
    body('userId')
      .isString()
      .withMessage('User ID is required'),
    body('transactionId')
      .isString()
      .withMessage('Transaction ID is required'),
    body('provider')
      .isIn(['stripe', 'orange_money', 'afrimoney'])
      .withMessage('Invalid provider'),
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be at least 0.01'),
    validateRequest
  ],
  async (req, res, next) => {
    // Clear user payment methods cache when creating an internal payment
    try {
      await clearUserPaymentMethodsCache(req.body.userId);
      next();
    } catch (error) {
      next(error);
    }
  },
  paymentController.createInternalPayment
);

// Create internal withdrawal
router.post(
  '/internal/withdrawal',
  authenticateService,
  [
    body('userId')
      .isString()
      .withMessage('User ID is required'),
    body('transactionId')
      .isString()
      .withMessage('Transaction ID is required'),
    body('provider')
      .isIn(['stripe', 'orange_money', 'afrimoney'])
      .withMessage('Invalid provider'),
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be at least 0.01'),
    body('recipientInfo')
      .isObject()
      .withMessage('Recipient info is required'),
    validateRequest
  ],
  async (req, res, next) => {
    // Clear user payment methods cache when creating an internal withdrawal
    try {
      await clearUserPaymentMethodsCache(req.body.userId);
      next();
    } catch (error) {
      next(error);
    }
  },
  paymentController.createInternalWithdrawal
);

// Admin routes
// Get all payments (admin only) - cache for 1 minute (60 seconds)
router.get(
  '/admin/all',
  authenticate,
  authorize(['admin', 'super_admin']),
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('type')
      .optional()
      .isIn(['payment', 'withdrawal'])
      .withMessage('Invalid payment type'),
    query('provider')
      .optional()
      .isIn(['stripe', 'orange_money', 'afrimoney'])
      .withMessage('Invalid provider'),
    query('status')
      .optional()
      .isIn(['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'])
      .withMessage('Invalid status'),
    query('minAmount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Minimum amount must be a non-negative number'),
    query('maxAmount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Maximum amount must be a non-negative number'),
    validateRequest
  ],
  cacheMiddleware(60),
  paymentController.getAllPayments
);

// Get payment statistics (admin only) - cache for 5 minutes (300 seconds)
router.get(
  '/admin/statistics',
  authenticate,
  authorize(['admin', 'super_admin']),
  cacheMiddleware(300),
  paymentController.getPaymentStatistics
);

module.exports = router;