const express = require('express');
const { body, query, param } = require('express-validator');
const transactionController = require('../controllers/transaction.controller');
const { validateRequest } = require('../middleware/validateRequest');
const { authenticate, authenticateService } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { cacheMiddleware } = require('../config/redis');

const router = express.Router();

// Create transaction
router.post(
  '/',
  authenticate,
  [
    body('type')
      .isIn(['generation', 'transfer', 'payment', 'withdrawal', 'refund', 'bonus', 'adjustment'])
      .withMessage('Invalid transaction type'),
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be at least 0.01'),
    body('recipientId')
      .optional()
      .isMongoId()
      .withMessage('Invalid recipient ID'),
    validateRequest
  ],
  transactionController.createTransaction
);

// Get transaction by ID - cache for 5 minutes (300 seconds)
router.get(
  '/:id',
  authenticate,
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid transaction ID'),
    validateRequest
  ],
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
      .isIn(['generation', 'transfer', 'payment', 'withdrawal', 'refund', 'bonus', 'adjustment'])
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
    validateRequest
  ],
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
    validateRequest
  ],
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
      .isIn(['generation', 'transfer', 'payment', 'withdrawal', 'refund', 'bonus', 'adjustment'])
      .withMessage('Invalid transaction type'),
    query('status')
      .optional()
      .isIn(['pending', 'completed', 'failed', 'cancelled', 'refunded'])
      .withMessage('Invalid status'),
    query('userId')
      .optional()
      .isMongoId()
      .withMessage('Invalid user ID'),
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
