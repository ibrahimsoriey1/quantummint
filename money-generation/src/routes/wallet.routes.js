const express = require('express');
const { body, query } = require('express-validator');
const walletController = require('../controllers/wallet.controller');
const { validateRequest } = require('../middleware/validateRequest');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { cacheMiddleware, clearCache } = require('../config/redis');

const router = express.Router();

// Get user wallet - cache for 5 minutes (300 seconds)
router.get(
  '/my-wallet',
  authenticate,
  cacheMiddleware(300),
  walletController.getUserWallet
);

// Update generation method
router.put(
  '/method',
  authenticate,
  [
    body('method')
      .isIn(['standard', 'accelerated', 'premium'])
      .withMessage('Invalid generation method'),
    validateRequest
  ],
  async (req, res, next) => {
    // Clear cache for this user's wallet before updating
    try {
      await clearCache(`*${req.user.id}*`);
      next();
    } catch (error) {
      next(error);
    }
  },
  walletController.updateGenerationMethod
);

// Admin routes
// Get all wallets (admin only) - cache for 2 minutes (120 seconds)
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
    query('method')
      .optional()
      .isIn(['standard', 'accelerated', 'premium'])
      .withMessage('Invalid method'),
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
  walletController.getAllWallets
);

// Get wallet by user ID (admin only) - cache for 5 minutes (300 seconds)
router.get(
  '/admin/user/:userId',
  authenticate,
  authorize(['admin', 'super_admin']),
  cacheMiddleware(300),
  walletController.getWalletByUserId
);

// Update wallet status (admin only)
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
    // Clear cache for this user's wallet and all wallets list before updating
    try {
      await clearCache(`*${req.params.userId}*`);
      await clearCache('*admin/all*');
      next();
    } catch (error) {
      next(error);
    }
  },
  walletController.updateWalletStatus
);

// Get wallet statistics (admin only) - cache for 5 minutes (300 seconds)
router.get(
  '/admin/statistics',
  authenticate,
  authorize(['admin', 'super_admin']),
  cacheMiddleware(300),
  walletController.getWalletStatistics
);

module.exports = router;