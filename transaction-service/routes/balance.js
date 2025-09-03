const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { authenticateToken, requireOwnership, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const Balance = require('../models/Balance');
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

// Get user's balance (create if doesn't exist)
router.get('/', asyncHandler(async (req, res) => {
  const balance = await Balance.getUserBalance(req.user.id);

  res.json({
    message: 'Balance retrieved successfully',
    balance: {
      userId: balance.userId,
      walletId: balance.walletId,
      defaultCurrency: balance.defaultCurrency,
      status: balance.status,
      balances: Object.fromEntries(balance.balances),
      totalBalanceUSD: balance.totalBalanceUSD,
      totalAvailableUSD: balance.totalAvailableUSD,
      totalLockedUSD: balance.totalLockedUSD,
      isActive: balance.isActive,
      isFrozen: balance.isFrozen,
      isSuspended: balance.isSuspended,
      lastActivity: balance.security.lastActivity,
      kycLevel: balance.compliance.kycLevel,
      verificationStatus: balance.compliance.verificationStatus
    }
  });
}));

// Get balance for specific currency
router.get('/currency/:currency', [
  param('currency')
    .isLength({ min: 3, max: 3 })
    .isUppercase()
    .withMessage('Currency must be a 3-letter uppercase code'),
  validateRequest
], asyncHandler(async (req, res) => {
  const balance = await Balance.getUserBalance(req.user.id);
  const currencyBalance = balance.getBalance(req.params.currency);

  res.json({
    message: 'Currency balance retrieved successfully',
    currency: req.params.currency,
    balance: {
      available: currencyBalance.available,
      locked: currencyBalance.locked,
      pending: currencyBalance.pending,
      total: currencyBalance.total,
      lastUpdated: currencyBalance.lastUpdated
    }
  });
}));

// Get all balances
router.get('/all', asyncHandler(async (req, res) => {
  const balance = await Balance.getUserBalance(req.user.id);
  const allBalances = {};

  for (const [currency, currencyBalance] of balance.balances) {
    allBalances[currency] = {
      available: currencyBalance.available,
      locked: currencyBalance.locked,
      pending: currencyBalance.pending,
      total: currencyBalance.total,
      lastUpdated: currencyBalance.lastUpdated
    };
  }

  res.json({
    message: 'All balances retrieved successfully',
    balances: allBalances,
    defaultCurrency: balance.defaultCurrency
  });
}));

// Add balance (admin only)
router.post('/add', [
  requireAdmin,
  body('userId')
    .notEmpty()
    .withMessage('User ID is required'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('currency')
    .isLength({ min: 3, max: 3 })
    .isUppercase()
    .withMessage('Currency must be a 3-letter uppercase code'),
  body('type')
    .optional()
    .isIn(['available', 'locked', 'pending'])
    .withMessage('Type must be available, locked, or pending'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { userId, amount, currency, type = 'available', description } = req.body;

  const balance = await Balance.getUserBalance(userId);
  const previousBalance = balance.getBalance(currency);

  balance.updateBalance(currency, amount, type, 'credit');

  // Add to history
  balance.history.push({
    action: 'credit',
    amount,
    currency,
    type,
    previousBalance: previousBalance[type],
    newBalance: balance.getBalance(currency)[type],
    description: description || 'Admin balance addition',
    timestamp: new Date(),
    metadata: {
      adminId: req.user.id,
      adminUsername: req.user.username,
      source: 'admin-addition'
    }
  });

  await balance.save();

  logger.balance('Balance added by admin', {
    adminId: req.user.id,
    userId,
    amount,
    currency,
    type,
    newBalance: balance.getBalance(currency)
  });

  res.json({
    message: 'Balance added successfully',
    balance: {
      userId,
      currency,
      type,
      amount,
      previousBalance: previousBalance[type],
      newBalance: balance.getBalance(currency)[type],
      totalBalance: balance.getBalance(currency).total
    }
  });
}));

// Subtract balance (admin only)
router.post('/subtract', [
  requireAdmin,
  body('userId')
    .notEmpty()
    .withMessage('User ID is required'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('currency')
    .isLength({ min: 3, max: 3 })
    .isUppercase()
    .withMessage('Currency must be a 3-letter uppercase code'),
  body('type')
    .optional()
    .isIn(['available', 'locked', 'pending'])
    .withMessage('Type must be available, locked, or pending'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { userId, amount, currency, type = 'available', description } = req.body;

  const balance = await Balance.getUserBalance(userId);
  const currentBalance = balance.getBalance(currency);

  if (currentBalance[type] < amount) {
    return res.status(400).json({
      error: `Insufficient ${type} balance`,
      code: 'INSUFFICIENT_BALANCE',
      currentBalance: currentBalance[type],
      requestedAmount: amount
    });
  }

  const previousBalance = currentBalance[type];
  balance.updateBalance(currency, amount, type, 'debit');

  // Add to history
  balance.history.push({
    action: 'debit',
    amount,
    currency,
    type,
    previousBalance,
    newBalance: balance.getBalance(currency)[type],
    description: description || 'Admin balance subtraction',
    timestamp: new Date(),
    metadata: {
      adminId: req.user.id,
      adminUsername: req.user.username,
      source: 'admin-subtraction'
    }
  });

  await balance.save();

  logger.balance('Balance subtracted by admin', {
    adminId: req.user.id,
    userId,
    amount,
    currency,
    type,
    newBalance: balance.getBalance(currency)
  });

  res.json({
    message: 'Balance subtracted successfully',
    balance: {
      userId,
      currency,
      type,
      amount,
      previousBalance,
      newBalance: balance.getBalance(currency)[type],
      totalBalance: balance.getBalance(currency).total
    }
  });
}));

// Lock balance
router.post('/lock', [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('currency')
    .isLength({ min: 3, max: 3 })
    .isUppercase()
    .withMessage('Currency must be a 3-letter uppercase code'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { amount, currency, description } = req.body;

  const balance = await Balance.getUserBalance(req.user.id);
  const previousBalance = balance.getBalance(currency);

  if (previousBalance.available < amount) {
    return res.status(400).json({
      error: 'Insufficient available balance',
      code: 'INSUFFICIENT_AVAILABLE_BALANCE',
      availableBalance: previousBalance.available,
      requestedAmount: amount
    });
  }

  balance.lockBalance(currency, amount);

  // Add to history
  balance.history.push({
    action: 'lock',
    amount,
    currency,
    type: 'available',
    previousBalance: previousBalance.available,
    newBalance: balance.getBalance(currency).available,
    description: description || 'Balance locked by user',
    timestamp: new Date(),
    metadata: {
      source: 'user-lock'
    }
  });

  await balance.save();

  logger.balance('Balance locked by user', {
    userId: req.user.id,
    amount,
    currency,
    newAvailableBalance: balance.getBalance(currency).available,
    newLockedBalance: balance.getBalance(currency).locked
  });

  res.json({
    message: 'Balance locked successfully',
    balance: {
      currency,
      amount,
      previousAvailableBalance: previousBalance.available,
      newAvailableBalance: balance.getBalance(currency).available,
      newLockedBalance: balance.getBalance(currency).locked
    }
  });
}));

// Unlock balance
router.post('/unlock', [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('currency')
    .isLength({ min: 3, max: 3 })
    .isUppercase()
    .withMessage('Currency must be a 3-letter uppercase code'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { amount, currency, description } = req.body;

  const balance = await Balance.getUserBalance(req.user.id);
  const previousBalance = balance.getBalance(currency);

  if (previousBalance.locked < amount) {
    return res.status(400).json({
      error: 'Insufficient locked balance',
      code: 'INSUFFICIENT_LOCKED_BALANCE',
      lockedBalance: previousBalance.locked,
      requestedAmount: amount
    });
  }

  balance.unlockBalance(currency, amount);

  // Add to history
  balance.history.push({
    action: 'unlock',
    amount,
    currency,
    type: 'locked',
    previousBalance: previousBalance.locked,
    newBalance: balance.getBalance(currency).locked,
    description: description || 'Balance unlocked by user',
    timestamp: new Date(),
    metadata: {
      source: 'user-unlock'
    }
  });

  await balance.save();

  logger.balance('Balance unlocked by user', {
    userId: req.user.id,
    amount,
    currency,
    newAvailableBalance: balance.getBalance(currency).available,
    newLockedBalance: balance.getBalance(currency).locked
  });

  res.json({
    message: 'Balance unlocked successfully',
    balance: {
      currency,
      amount,
      previousLockedBalance: previousBalance.locked,
      newLockedBalance: balance.getBalance(currency).locked,
      newAvailableBalance: balance.getBalance(currency).available
    }
  });
}));

// Get balance history
router.get('/history', [
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
    .isLength({ min: 3, max: 3 })
    .isUppercase()
    .withMessage('Invalid currency format'),
  query('action')
    .optional()
    .isIn(['credit', 'debit', 'lock', 'unlock', 'adjustment', 'fee', 'exchange'])
    .withMessage('Invalid action filter'),
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
  const balance = await Balance.getUserBalance(req.user.id);
  const options = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 20,
    currency: req.query.currency,
    action: req.query.action,
    startDate: req.query.startDate,
    endDate: req.query.endDate
  };

  let filteredHistory = balance.history;

  // Apply filters
  if (options.currency) {
    filteredHistory = filteredHistory.filter(entry => entry.currency === options.currency);
  }

  if (options.action) {
    filteredHistory = filteredHistory.filter(entry => entry.action === options.action);
  }

  if (options.startDate || options.endDate) {
    filteredHistory = filteredHistory.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      if (options.startDate && entryDate < new Date(options.startDate)) return false;
      if (options.endDate && entryDate > new Date(options.endDate)) return false;
      return true;
    });
  }

  // Sort by timestamp (newest first)
  filteredHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Pagination
  const total = filteredHistory.length;
  const startIndex = (options.page - 1) * options.limit;
  const endIndex = startIndex + options.limit;
  const paginatedHistory = filteredHistory.slice(startIndex, endIndex);

  res.json({
    message: 'Balance history retrieved successfully',
    history: paginatedHistory,
    pagination: {
      page: options.page,
      limit: options.limit,
      total,
      pages: Math.ceil(total / options.limit)
    }
  });
}));

// Get balance limits
router.get('/limits', asyncHandler(async (req, res) => {
  const balance = await Balance.getUserBalance(req.user.id);

  res.json({
    message: 'Balance limits retrieved successfully',
    limits: {
      daily: Object.fromEntries(balance.limits.daily),
      monthly: Object.fromEntries(balance.limits.monthly),
      transaction: {
        minAmount: Object.fromEntries(balance.limits.transaction.minAmount),
        maxAmount: Object.fromEntries(balance.limits.transaction.maxAmount)
      }
    }
  });
}));

// Update balance limits (admin only)
router.put('/limits', [
  requireAdmin,
  body('userId')
    .notEmpty()
    .withMessage('User ID is required'),
  body('limits')
    .isObject()
    .withMessage('Limits must be an object'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { userId, limits } = req.body;

  const balance = await Balance.getUserBalance(userId);

  // Update daily limits
  if (limits.daily) {
    for (const [currency, limitData] of Object.entries(limits.daily)) {
      if (limitData.amount !== undefined) {
        balance.limits.daily.set(currency, {
          amount: limitData.amount,
          used: balance.limits.daily.get(currency)?.used || 0,
          resetTime: new Date()
        });
      }
    }
  }

  // Update monthly limits
  if (limits.monthly) {
    for (const [currency, limitData] of Object.entries(limits.monthly)) {
      if (limitData.amount !== undefined) {
        balance.limits.monthly.set(currency, {
          amount: limitData.amount,
          used: balance.limits.monthly.get(currency)?.used || 0,
          resetTime: new Date()
        });
      }
    }
  }

  // Update transaction limits
  if (limits.transaction) {
    if (limits.transaction.minAmount) {
      for (const [currency, amount] of Object.entries(limits.transaction.minAmount)) {
        balance.limits.transaction.minAmount.set(currency, amount);
      }
    }
    if (limits.transaction.maxAmount) {
      for (const [currency, amount] of Object.entries(limits.transaction.maxAmount)) {
        balance.limits.transaction.maxAmount.set(currency, amount);
      }
    }
  }

  await balance.save();

  logger.balance('Balance limits updated by admin', {
    adminId: req.user.id,
    userId,
    limits
  });

  res.json({
    message: 'Balance limits updated successfully',
    limits: {
      daily: Object.fromEntries(balance.limits.daily),
      monthly: Object.fromEntries(balance.limits.monthly),
      transaction: {
        minAmount: Object.fromEntries(balance.limits.transaction.minAmount),
        maxAmount: Object.fromEntries(balance.limits.transaction.maxAmount)
      }
    }
  });
}));

// Get balance status
router.get('/status', asyncHandler(async (req, res) => {
  const balance = await Balance.getUserBalance(req.user.id);

  res.json({
    message: 'Balance status retrieved successfully',
    status: {
      userId: balance.userId,
      walletId: balance.walletId,
      status: balance.status,
      isActive: balance.isActive,
      isFrozen: balance.isFrozen,
      isSuspended: balance.isSuspended,
      lastActivity: balance.security.lastActivity,
      kycLevel: balance.compliance.kycLevel,
      verificationStatus: balance.compliance.verificationStatus,
      totalTransactions: balance.metrics.totalTransactions,
      lastTransactionAt: balance.metrics.lastTransactionAt
    }
  });
}));

// Create balance backup
router.post('/backup', asyncHandler(async (req, res) => {
  const balance = await Balance.getUserBalance(req.user.id);

  const backup = {
    userId: balance.userId,
    walletId: balance.walletId,
    balances: Object.fromEntries(balance.balances),
    limits: {
      daily: Object.fromEntries(balance.limits.daily),
      monthly: Object.fromEntries(balance.limits.monthly),
      transaction: {
        minAmount: Object.fromEntries(balance.limits.transaction.minAmount),
        maxAmount: Object.fromEntries(balance.limits.transaction.maxAmount)
      }
    },
    security: balance.security,
    compliance: balance.compliance,
    metrics: balance.metrics,
    createdAt: new Date().toISOString(),
    backupId: `BACKUP_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`
  };

  // Store backup in Redis for 30 days
  const redisClient = require('../config/redis').getClient();
  await redisClient.setEx(
    `balance_backup:${req.user.id}:${backup.backupId}`,
    30 * 24 * 60 * 60, // 30 days
    JSON.stringify(backup)
  );

  logger.balance('Balance backup created', {
    userId: req.user.id,
    backupId: backup.backupId
  });

  res.json({
    message: 'Balance backup created successfully',
    backup: {
      backupId: backup.backupId,
      createdAt: backup.createdAt,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }
  });
}));

// Restore balance from backup (admin only)
router.post('/restore', [
  requireAdmin,
  body('userId')
    .notEmpty()
    .withMessage('User ID is required'),
  body('backupId')
    .notEmpty()
    .withMessage('Backup ID is required'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { userId, backupId } = req.body;

  // Retrieve backup from Redis
  const redisClient = require('../config/redis').getClient();
  const backupData = await redisClient.get(`balance_backup:${userId}:${backupId}`);

  if (!backupData) {
    return res.status(404).json({
      error: 'Backup not found or expired',
      code: 'BACKUP_NOT_FOUND'
    });
  }

  const backup = JSON.parse(backupData);
  const balance = await Balance.getUserBalance(userId);

  // Restore balance data
  balance.balances = new Map(Object.entries(backup.balances));
  balance.limits = {
    daily: new Map(Object.entries(backup.limits.daily)),
    monthly: new Map(Object.entries(backup.limits.monthly)),
    transaction: {
      minAmount: new Map(Object.entries(backup.limits.transaction.minAmount)),
      maxAmount: new Map(Object.entries(backup.limits.transaction.maxAmount))
    }
  };

  // Add restoration to history
  for (const [currency, currencyBalance] of balance.balances) {
    balance.history.push({
      action: 'adjustment',
      amount: currencyBalance.total,
      currency,
      type: 'available',
      previousBalance: 0,
      newBalance: currencyBalance.total,
      description: `Balance restored from backup ${backupId}`,
      timestamp: new Date(),
      metadata: {
        adminId: req.user.id,
        adminUsername: req.user.username,
        source: 'backup-restoration',
        backupId
      }
    });
  }

  await balance.save();

  logger.balance('Balance restored from backup', {
    adminId: req.user.id,
    userId,
    backupId
  });

  res.json({
    message: 'Balance restored successfully from backup',
    backup: {
      backupId,
      restoredAt: new Date().toISOString(),
      restoredBy: req.user.id
    }
  });
}));

module.exports = router;
