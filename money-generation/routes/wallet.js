const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { authenticateToken, requireOwnership } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const Wallet = require('../models/Wallet');
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

// GET /api/v1/wallet - Get user's wallet information
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const wallet = await Wallet.getUserWallet(userId);
  
  if (!wallet) {
    // Create wallet if it doesn't exist
    const newWallet = await Wallet.createWallet(userId, req.query.currency || 'USD');
    logger.wallet(`Created new wallet for user ${userId}`, { userId, walletId: newWallet._id });
    
    return res.json({
      success: true,
      message: 'New wallet created',
      data: newWallet
    });
  }

  res.json({
    success: true,
    data: wallet
  });
}));

// GET /api/v1/wallet/balance - Get wallet balances
router.get('/balance', [
  query('currency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP', 'XAF', 'XOF', 'BTC', 'ETH', 'QMT'])
    .withMessage('Invalid currency'),
  validateRequest
], asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const currency = req.query.currency;

  const wallet = await Wallet.getUserWallet(userId);
  if (!wallet) {
    return res.status(404).json({
      error: 'Wallet not found',
      code: 'WALLET_NOT_FOUND'
    });
  }

  if (currency) {
    const balance = wallet.getBalance(currency);
    const lockedBalance = wallet.getLockedBalance(currency);
    
    res.json({
      success: true,
      data: {
        currency,
        balance,
        lockedBalance,
        availableBalance: balance - lockedBalance
      }
    });
  } else {
    const balances = wallet.balances.map(b => ({
      currency: b.currency,
      balance: b.amount,
      lockedBalance: b.locked,
      availableBalance: b.amount - b.locked,
      lastUpdated: b.lastUpdated
    }));

    res.json({
      success: true,
      data: {
        totalBalance: wallet.totalBalance,
        totalLocked: wallet.totalLocked,
        availableBalance: wallet.availableBalance,
        balances
      }
    });
  }
}));

// POST /api/v1/wallet/balance/add - Add balance to wallet (admin only)
router.post('/balance/add', [
  body('userId')
    .isMongoId()
    .withMessage('Invalid user ID'),
  body('currency')
    .isIn(['USD', 'EUR', 'GBP', 'XAF', 'XOF', 'BTC', 'ETH', 'QMT'])
    .withMessage('Invalid currency'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  body('reason')
    .isLength({ min: 5, max: 200 })
    .withMessage('Reason must be between 5 and 200 characters'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { userId, currency, amount, reason } = req.body;

  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required for balance operations',
      code: 'ADMIN_ACCESS_REQUIRED'
    });
  }

  const wallet = await Wallet.getUserWallet(userId);
  if (!wallet) {
    return res.status(404).json({
      error: 'Wallet not found',
      code: 'WALLET_NOT_FOUND'
    });
  }

  await wallet.updateBalance(currency, amount, 'add');

  logger.wallet(`Balance added to wallet ${wallet._id}`, {
    adminId: req.user.id,
    userId,
    currency,
    amount,
    reason,
    newBalance: wallet.getBalance(currency)
  });

  res.json({
    success: true,
    message: 'Balance added successfully',
    data: {
      currency,
      amount,
      newBalance: wallet.getBalance(currency)
    }
  });
}));

// POST /api/v1/wallet/balance/subtract - Subtract balance from wallet (admin only)
router.post('/balance/subtract', [
  body('userId')
    .isMongoId()
    .withMessage('Invalid user ID'),
  body('currency')
    .isIn(['USD', 'EUR', 'GBP', 'XAF', 'XOF', 'BTC', 'ETH', 'QMT'])
    .withMessage('Invalid currency'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  body('reason')
    .isLength({ min: 5, max: 200 })
    .withMessage('Reason must be between 5 and 200 characters'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { userId, currency, amount, reason } = req.body;

  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required for balance operations',
      code: 'ADMIN_ACCESS_REQUIRED'
    });
  }

  const wallet = await Wallet.getUserWallet(userId);
  if (!wallet) {
    return res.status(404).json({
      error: 'Wallet not found',
      code: 'WALLET_NOT_FOUND'
    });
  }

  const currentBalance = wallet.getBalance(currency);
  if (currentBalance < amount) {
    return res.status(400).json({
      error: 'Insufficient balance',
      code: 'INSUFFICIENT_BALANCE',
      data: {
        currentBalance,
        requestedAmount: amount
      }
    });
  }

  await wallet.updateBalance(currency, amount, 'subtract');

  logger.wallet(`Balance subtracted from wallet ${wallet._id}`, {
    adminId: req.user.id,
    userId,
    currency,
    amount,
    reason,
    newBalance: wallet.getBalance(currency)
  });

  res.json({
    success: true,
    message: 'Balance subtracted successfully',
    data: {
      currency,
      amount,
      newBalance: wallet.getBalance(currency)
    }
  });
}));

// POST /api/v1/wallet/balance/lock - Lock balance in wallet
router.post('/balance/lock', [
  body('currency')
    .isIn(['USD', 'EUR', 'GBP', 'XAF', 'XOF', 'BTC', 'ETH', 'QMT'])
    .withMessage('Invalid currency'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  body('reason')
    .isLength({ min: 5, max: 200 })
    .withMessage('Reason must be between 5 and 200 characters'),
  validateRequest
], asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { currency, amount, reason } = req.body;

  const wallet = await Wallet.getUserWallet(userId);
  if (!wallet) {
    return res.status(404).json({
      error: 'Wallet not found',
      code: 'WALLET_NOT_FOUND'
    });
  }

  await wallet.lockBalance(currency, amount);

  logger.wallet(`Balance locked in wallet ${wallet._id}`, {
    userId,
    currency,
    amount,
    reason,
    newBalance: wallet.getBalance(currency),
    newLockedBalance: wallet.getLockedBalance(currency)
  });

  res.json({
    success: true,
    message: 'Balance locked successfully',
    data: {
      currency,
      amount,
      newBalance: wallet.getBalance(currency),
      newLockedBalance: wallet.getLockedBalance(currency)
    }
  });
}));

// POST /api/v1/wallet/balance/unlock - Unlock balance in wallet
router.post('/balance/unlock', [
  body('currency')
    .isIn(['USD', 'EUR', 'GBP', 'XAF', 'XOF', 'BTC', 'ETH', 'QMT'])
    .withMessage('Invalid currency'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  validateRequest
], asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { currency, amount } = req.body;

  const wallet = await Wallet.getUserWallet(userId);
  if (!wallet) {
    return res.status(404).json({
      error: 'Wallet not found',
      code: 'WALLET_NOT_FOUND'
    });
  }

  await wallet.unlockBalance(currency, amount);

  logger.wallet(`Balance unlocked in wallet ${wallet._id}`, {
    userId,
    currency,
    amount,
    newBalance: wallet.getBalance(currency),
    newLockedBalance: wallet.getLockedBalance(currency)
  });

  res.json({
    success: true,
    message: 'Balance unlocked successfully',
    data: {
      currency,
      amount,
      newBalance: wallet.getBalance(currency),
      newLockedBalance: wallet.getLockedBalance(currency)
    }
  });
}));

// GET /api/v1/wallet/transactions - Get wallet transaction history
router.get('/transactions', [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('currency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP', 'XAF', 'XOF', 'BTC', 'ETH', 'QMT'])
    .withMessage('Invalid currency'),
  query('type')
    .optional()
    .isIn(['generation', 'withdrawal', 'transfer', 'fee'])
    .withMessage('Invalid transaction type'),
  validateRequest
], asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const options = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 20,
    currency: req.query.currency,
    type: req.query.type
  };

  // This would typically call a transaction service
  // For now, we'll return a placeholder
  res.json({
    success: true,
    message: 'Transaction history endpoint - requires Transaction Service integration',
    data: {
      transactions: [],
      pagination: {
        page: options.page,
        limit: options.limit,
        total: 0,
        pages: 0
      }
    }
  });
}));

// GET /api/v1/wallet/limits - Get wallet limits
router.get('/limits', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const wallet = await Wallet.getUserWallet(userId);
  if (!wallet) {
    return res.status(404).json({
      error: 'Wallet not found',
      code: 'WALLET_NOT_FOUND'
    });
  }

  res.json({
    success: true,
    data: {
      generation: {
        daily: wallet.limits.dailyGeneration,
        monthly: wallet.limits.monthlyGeneration,
        yearly: wallet.limits.yearlyGeneration
      },
      withdrawal: {
        daily: wallet.limits.dailyWithdrawal,
        monthly: wallet.limits.monthlyWithdrawal,
        yearly: wallet.limits.yearlyWithdrawal
      },
      balance: {
        max: wallet.limits.maxBalance
      }
    }
  });
}));

// PUT /api/v1/wallet/limits - Update wallet limits (admin only)
router.put('/limits', [
  body('userId')
    .isMongoId()
    .withMessage('Invalid user ID'),
  body('limits')
    .isObject()
    .withMessage('Limits must be an object'),
  body('limits.dailyGeneration')
    .optional()
    .isFloat({ min: 100, max: 100000 })
    .withMessage('Daily generation limit must be between 100 and 100,000'),
  body('limits.monthlyGeneration')
    .optional()
    .isFloat({ min: 1000, max: 1000000 })
    .withMessage('Monthly generation limit must be between 1,000 and 1,000,000'),
  body('limits.yearlyGeneration')
    .optional()
    .isFloat({ min: 10000, max: 10000000 })
    .withMessage('Yearly generation limit must be between 10,000 and 10,000,000'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { userId, limits } = req.body;

  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required for limit updates',
      code: 'ADMIN_ACCESS_REQUIRED'
    });
  }

  const wallet = await Wallet.getUserWallet(userId);
  if (!wallet) {
    return res.status(404).json({
      error: 'Wallet not found',
      code: 'WALLET_NOT_FOUND'
    });
  }

  // Update limits
  Object.keys(limits).forEach(key => {
    if (wallet.limits.hasOwnProperty(key)) {
      wallet.limits[key] = limits[key];
    }
  });

  await wallet.save();

  logger.wallet(`Wallet limits updated for user ${userId}`, {
    adminId: req.user.id,
    userId,
    newLimits: limits
  });

  res.json({
    success: true,
    message: 'Wallet limits updated successfully',
    data: wallet.limits
  });
}));

// GET /api/v1/wallet/status - Get wallet status
router.get('/status', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const wallet = await Wallet.getUserWallet(userId);
  if (!wallet) {
    return res.status(404).json({
      error: 'Wallet not found',
      code: 'WALLET_NOT_FOUND'
    });
  }

  res.json({
    success: true,
    data: {
      status: wallet.status,
      isActive: wallet.isActive,
      canGenerate: wallet.canGenerate,
      walletAddress: wallet.walletAddress,
      lastActivity: wallet.usage.lastActivity,
      version: wallet.metadata.version
    }
  });
}));

// POST /api/v1/wallet/backup - Create wallet backup
router.post('/backup', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const wallet = await Wallet.getUserWallet(userId);
  if (!wallet) {
    return res.status(404).json({
      error: 'Wallet not found',
      code: 'WALLET_NOT_FOUND'
    });
  }

  // Create backup data
  const backupData = {
    walletId: wallet._id,
    walletAddress: wallet.walletAddress,
    balances: wallet.balances,
    limits: wallet.limits,
    settings: wallet.settings,
    metadata: {
      ...wallet.metadata,
      backupCreatedAt: new Date(),
      backupVersion: 'v1.0'
    }
  };

  // Update last backup timestamp
  wallet.metadata.lastBackup = new Date();
  await wallet.save();

  logger.wallet(`Wallet backup created for user ${userId}`, {
    userId,
    walletId: wallet._id
  });

  res.json({
    success: true,
    message: 'Wallet backup created successfully',
    data: {
      backupId: `backup_${Date.now()}`,
      backupCreatedAt: wallet.metadata.lastBackup,
      backupData
    }
  });
}));

// POST /api/v1/wallet/restore - Restore wallet from backup (admin only)
router.post('/restore', [
  body('userId')
    .isMongoId()
    .withMessage('Invalid user ID'),
  body('backupData')
    .isObject()
    .withMessage('Backup data must be an object'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { userId, backupData } = req.body;

  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required for wallet restoration',
      code: 'ADMIN_ACCESS_REQUIRED'
    });
  }

  const wallet = await Wallet.getUserWallet(userId);
  if (!wallet) {
    return res.status(404).json({
      error: 'Wallet not found',
      code: 'WALLET_NOT_FOUND'
    });
  }

  // Restore wallet data
  if (backupData.balances) wallet.balances = backupData.balances;
  if (backupData.limits) wallet.limits = backupData.limits;
  if (backupData.settings) wallet.settings = backupData.settings;
  
  wallet.metadata.lastBackup = new Date();
  await wallet.save();

  logger.wallet(`Wallet restored from backup for user ${userId}`, {
    adminId: req.user.id,
    userId,
    walletId: wallet._id
  });

  res.json({
    success: true,
    message: 'Wallet restored successfully',
    data: {
      walletId: wallet._id,
      restoredAt: new Date()
    }
  });
}));

module.exports = router;
