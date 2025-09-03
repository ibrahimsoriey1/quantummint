const express = require('express');
const { body, query } = require('express-validator');
const balanceController = require('../controllers/balance.controller');
const { validateRequest } = require('../middleware/validateRequest');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { cacheMiddleware, clearUserCache, clearAllCache } = require('../config/redis');

const router = express.Router();

// Get user balance - cache for 1 minute (60 seconds)
router.get(
  '/my-balance',
  authenticate,
  cacheMiddleware(60),
  balanceController.getUserBalance
);

// Admin routes
// Get balance by user ID (admin only) - cache for 2 minutes (120 seconds)
router.get(
  '/admin/user/:userId',
  authenticate,
  authorize(['admin', 'super_admin']),
  cacheMiddleware(120),
  balanceController.getBalanceByUserId
);

// Update balance status (admin only)
router.put(
  '/admin/status/:userId',
  authenticate,
  authorize(['admin', 'super_admin']),
  [
    body('status')
      .isIn(['active', 'suspended', 'locked'])
      .withMessage('Invalid status'),
    validateRequest
  ],
  async (req, res, next) => {
    // Clear cache for this user's balance and all balances
    try {
      await clearUserCache(req.params.userId);
      await clearAllCache();
      next();
    } catch (error) {
      next(error);
    }
  },
  balanceController.updateBalanceStatus
);

// Get all balances (admin only) - cache for 2 minutes (120 seconds)
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
    query('status')
      .optional()
      .isIn(['active', 'suspended', 'locked'])
      .withMessage('Invalid status'),
    query('minBalance')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Minimum balance must be a non-negative number'),
    query('maxBalance')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Maximum balance must be a non-negative number'),
    validateRequest
  ],
  cacheMiddleware(120),
  balanceController.getAllBalances
);

// Get balance statistics (admin only) - cache for 5 minutes (300 seconds)
router.get(
  '/admin/statistics',
  authenticate,
  authorize(['admin', 'super_admin']),
  cacheMiddleware(300),
  balanceController.getBalanceStatistics
);

module.exports = router;
