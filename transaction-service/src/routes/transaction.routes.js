const express = require('express');
const { body, query, param } = require('express-validator');
const transactionController = require('../controllers/transaction.controller');
const { validateRequest } = require('../middleware/validateRequest');
const { authenticate, authenticateService } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { cacheMiddleware, clearUserCache, clearAllCache } = require('../config/redis');
const { idempotencyMiddleware } = require('../middleware/idempotency');

const router = express.Router();

// Create transaction
router.post(
  '/',
  authenticate,
  idempotencyMiddleware('tx:create', 900),
  [
    body('type')
      .isIn(['transfer', 'payment', 'withdrawal', 'refund'])
      .withMessage('Invalid transaction type'),
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be at least 0.01'),
    body('fee')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Fee must be a non-negative number'),
    body('description')
      .optional()
      .isString()
      .withMessage('Description must be a string'),
    body('reference')
      .optional()
      .isString()
      .withMessage('Reference must be a string'),
    body('method')
      .optional()
      .isString()
      .withMessage('Method must be a string'),
    body('provider')
      .optional()
      .isString()
      .withMessage('Provider must be a string'),
    body('recipientId')
      .optional()
      .isString()
      .withMessage('Recipient ID must be a string'),
    body('recipientInfo')
      .optional()
      .isObject()
      .withMessage('Recipient info must be an object'),
    body('metadata')
      .optional()
      .isObject()
      .withMessage('Metadata must be an object'),
    validateRequest
  ],
  async (req, res, next) => {
    // Clear cache for this user's transactions
    try {
      await clearUserCache(req.user.id);
      
      // If it's a transfer, also clear recipient's cache
      if (req.body.type === 'transfer' && req.body.recipientId) {
        await clearUserCache(req.body.recipientId);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  },
  transactionController.createTransaction
);

// Get transaction by ID - cache for 5 minutes (300 seconds)
router.get(
  '/:id',
  authenticate,
  cacheMiddleware(300),
  transactionController.getTransactionById
);

// Get user transactions - cache for 2 minutes (120 seconds)
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
      .isIn(['generation', 'transfer', 'payment', 'withdrawal', 'refund', 'fee', 'bonus', 'adjustment'])
      .withMessage('Invalid transaction type'),
    query('status')
      .optional()
      .isIn(['pending', 'completed', 'failed', 'cancelled', 'refunded'])
      .withMessage('Invalid status'),
    validateRequest
  ],
  cacheMiddleware(120),
  transactionController.getUserTransactions
);

// Internal routes (service to service)
// Create internal transaction
router.post(
  '/internal',
  authenticateService,
  [
    body('userId')
      .isString()
      .withMessage('User ID is required'),
    body('type')
      .isIn(['generation', 'transfer', 'payment', 'withdrawal', 'refund', 'fee', 'bonus', 'adjustment'])
      .withMessage('Invalid transaction type'),
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be at least 0.01'),
    body('fee')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Fee must be a non-negative number'),
    validateRequest
  ],
  async (req, res, next) => {
    // Clear cache for this user's transactions
    try {
      await clearUserCache(req.body.userId);
      next();
    } catch (error) {
      next(error);
    }
  },
  transactionController.createInternalTransaction
);

// Complete payment transaction
router.post(
  '/complete-payment/:id',
  authenticateService,
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid transaction ID'),
    body('success')
      .isBoolean()
      .withMessage('Success must be a boolean'),
    body('reason')
      .optional()
      .isString()
      .withMessage('Reason must be a string'),
    validateRequest
  ],
  async (req, res, next) => {
    // Clear all transaction caches as this could affect multiple users
    try {
      await clearAllCache();
      next();
    } catch (error) {
      next(error);
    }
  },
  transactionController.completePaymentTransaction
);

// Complete withdrawal transaction
router.post(
  '/complete-withdrawal/:id',
  authenticateService,
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid transaction ID'),
    body('success')
      .isBoolean()
      .withMessage('Success must be a boolean'),
    body('reason')
      .optional()
      .isString()
      .withMessage('Reason must be a string'),
    validateRequest
  ],
  async (req, res, next) => {
    // Clear all transaction caches as this could affect multiple users
    try {
      await clearAllCache();
      next();
    } catch (error) {
      next(error);
    }
  },
  transactionController.completeWithdrawalTransaction
);

// Admin routes
// Get all transactions (admin only) - cache for 1 minute (60 seconds)
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
      .isIn(['generation', 'transfer', 'payment', 'withdrawal', 'refund', 'fee', 'bonus', 'adjustment'])
      .withMessage('Invalid transaction type'),
    query('status')
      .optional()
      .isIn(['pending', 'completed', 'failed', 'cancelled', 'refunded'])
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
  transactionController.getAllTransactions
);

// Get transaction statistics (admin only) - cache for 5 minutes (300 seconds)
router.get(
  '/admin/statistics',
  authenticate,
  authorize(['admin', 'super_admin']),
  cacheMiddleware(300),
  transactionController.getTransactionStatistics
);

module.exports = router;