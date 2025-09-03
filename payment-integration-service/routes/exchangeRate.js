const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, requireModerator } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// Get current exchange rates
router.get('/current',
  authenticateToken,
  [
    query('baseCurrency').optional().isIn(['USD', 'EUR', 'GBP', 'XOF', 'XAF']),
    query('targetCurrencies').optional().isArray(),
    query('provider').optional().isIn(['default', 'backup1', 'backup2'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { baseCurrency = 'USD', targetCurrencies, provider = 'default' } = req.query;

    // Get current exchange rates
    const rates = await getCurrentExchangeRates(baseCurrency, targetCurrencies, provider);

    res.json({
      success: true,
      data: rates,
      timestamp: new Date().toISOString()
    });
  })
);

// Convert currency amount
router.post('/convert',
  authenticateToken,
  [
    body('amount').isFloat({ min: 0.01 }),
    body('fromCurrency').isIn(['USD', 'EUR', 'GBP', 'XOF', 'XAF']),
    body('toCurrency').isIn(['USD', 'EUR', 'GBP', 'XOF', 'XAF']),
    body('provider').optional().isIn(['default', 'backup1', 'backup2'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, fromCurrency, toCurrency, provider = 'default' } = req.body;

    // Convert currency
    const conversion = await convertCurrency(amount, fromCurrency, toCurrency, provider);

    res.json({
      success: true,
      data: conversion,
      timestamp: new Date().toISOString()
    });
  })
);

// Get exchange rate history
router.get('/history',
  authenticateToken,
  requireModerator,
  [
    query('baseCurrency').optional().isIn(['USD', 'EUR', 'GBP', 'XOF', 'XAF']),
    query('targetCurrency').optional().isIn(['USD', 'EUR', 'GBP', 'XOF', 'XAF']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('interval').optional().isIn(['hour', 'day', 'week', 'month']),
    query('limit').optional().isInt({ min: 1, max: 1000 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      baseCurrency,
      targetCurrency,
      startDate,
      endDate,
      interval = 'day',
      limit = 100
    } = req.query;

    // Get exchange rate history
    const history = await getExchangeRateHistory({
      baseCurrency,
      targetCurrency,
      startDate,
      endDate,
      interval,
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: history,
      timestamp: new Date().toISOString()
    });
  })
);

// Get exchange rate statistics
router.get('/stats',
  authenticateToken,
  requireModerator,
  [
    query('baseCurrency').optional().isIn(['USD', 'EUR', 'GBP', 'XOF', 'XAF']),
    query('targetCurrency').optional().isIn(['USD', 'EUR', 'GBP', 'XOF', 'XAF']),
    query('period').optional().isIn(['day', 'week', 'month', 'year'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { baseCurrency, targetCurrency, period = 'month' } = req.query;

    // Get exchange rate statistics
    const stats = await getExchangeRateStatistics(baseCurrency, targetCurrency, period);

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  })
);

// Admin: Update exchange rates manually
router.post('/update',
  authenticateToken,
  requireAdmin,
  [
    body('rates').isArray(),
    body('rates.*.baseCurrency').isIn(['USD', 'EUR', 'GBP', 'XOF', 'XAF']),
    body('rates.*.targetCurrency').isIn(['USD', 'EUR', 'GBP', 'XOF', 'XAF']),
    body('rates.*.rate').isFloat({ min: 0.0001 }),
    body('rates.*.provider').isIn(['manual', 'default', 'backup1', 'backup2']),
    body('effectiveFrom').optional().isISO8601()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { rates, effectiveFrom } = req.body;

    // Update exchange rates
    const result = await updateExchangeRates(rates, effectiveFrom, req.user.id);

    logger.info('Exchange rates updated manually', {
      updatedBy: req.user.id,
      ratesCount: rates.length,
      effectiveFrom
    });

    res.json({
      success: true,
      data: result,
      message: 'Exchange rates updated successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Admin: Refresh exchange rates from providers
router.post('/refresh',
  authenticateToken,
  requireAdmin,
  [
    body('providers').optional().isArray(),
    body('force').optional().isBoolean()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { providers, force = false } = req.body;

    // Refresh exchange rates
    const result = await refreshExchangeRates(providers, force, req.user.id);

    logger.info('Exchange rates refresh initiated', {
      updatedBy: req.user.id,
      providers: providers || 'all',
      force
    });

    res.json({
      success: true,
      data: result,
      message: 'Exchange rates refresh initiated',
      timestamp: new Date().toISOString()
    });
  })
);

// Admin: Get exchange rate configuration
router.get('/config',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    // Get exchange rate configuration
    const config = await getExchangeRateConfig();

    res.json({
      success: true,
      data: config,
      timestamp: new Date().toISOString()
    });
  })
);

// Admin: Update exchange rate configuration
router.put('/config',
  authenticateToken,
  requireAdmin,
  [
    body('updateInterval').optional().isInt({ min: 300000, max: 86400000 }), // 5 minutes to 24 hours
    body('providers').optional().isArray(),
    body('fallbackRates').optional().isObject(),
    body('autoRefresh').optional().isBoolean(),
    body('cacheTTL').optional().isInt({ min: 60000, max: 3600000 }) // 1 minute to 1 hour
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const configData = req.body;

    // Update exchange rate configuration
    const config = await updateExchangeRateConfig(configData);

    logger.info('Exchange rate configuration updated', {
      updatedBy: req.user.id,
      changes: Object.keys(configData)
    });

    res.json({
      success: true,
      data: config,
      message: 'Exchange rate configuration updated successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Helper functions
async function getCurrentExchangeRates(baseCurrency, targetCurrencies, provider) {
  // This would fetch current exchange rates from the provider
  // For now, return mock data
  const defaultTargets = ['EUR', 'GBP', 'XOF', 'XAF'];
  const targets = targetCurrencies || defaultTargets;

  return {
    baseCurrency,
    provider,
    timestamp: new Date().toISOString(),
    rates: targets.map(currency => ({
      currency,
      rate: getMockRate(baseCurrency, currency),
      lastUpdated: new Date().toISOString()
    }))
  };
}

async function convertCurrency(amount, fromCurrency, toCurrency, provider) {
  // This would perform actual currency conversion
  // For now, return mock data
  const rate = getMockRate(fromCurrency, toCurrency);
  const convertedAmount = amount * rate;

  return {
    originalAmount: amount,
    originalCurrency: fromCurrency,
    convertedAmount: parseFloat(convertedAmount.toFixed(2)),
    targetCurrency: toCurrency,
    exchangeRate: rate,
    provider,
    timestamp: new Date().toISOString()
  };
}

async function getExchangeRateHistory(filters) {
  // This would query the database for exchange rate history
  // For now, return mock data
  return [
    {
      baseCurrency: filters.baseCurrency || 'USD',
      targetCurrency: filters.targetCurrency || 'EUR',
      rate: 0.85,
      timestamp: new Date().toISOString(),
      provider: 'default'
    }
  ];
}

async function getExchangeRateStatistics(baseCurrency, targetCurrency, period) {
  // This would aggregate exchange rate statistics from the database
  // For now, return mock data
  return {
    baseCurrency: baseCurrency || 'USD',
    targetCurrency: targetCurrency || 'EUR',
    period,
    minRate: 0.82,
    maxRate: 0.88,
    avgRate: 0.85,
    volatility: 0.02,
    lastUpdated: new Date().toISOString()
  };
}

async function updateExchangeRates(rates, effectiveFrom, userId) {
  // This would update exchange rates in the database
  // For now, return mock data
  return {
    updatedRates: rates.length,
    effectiveFrom: effectiveFrom || new Date().toISOString(),
    updatedBy: userId,
    timestamp: new Date().toISOString()
  };
}

async function refreshExchangeRates(providers, force, userId) {
  // This would refresh exchange rates from external providers
  // For now, return mock data
  return {
    status: 'initiated',
    providers: providers || 'all',
    force,
    initiatedBy: userId,
    estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000).toISOString()
  };
}

async function getExchangeRateConfig() {
  // This would get exchange rate configuration from the database
  // For now, return mock data
  return {
    updateInterval: 3600000, // 1 hour
    providers: ['default', 'backup1', 'backup2'],
    fallbackRates: {
      'USD': { 'EUR': 0.85, 'GBP': 0.73, 'XOF': 550, 'XAF': 550 },
      'EUR': { 'USD': 1.18, 'GBP': 0.86, 'XOF': 647, 'XAF': 647 }
    },
    autoRefresh: true,
    cacheTTL: 300000 // 5 minutes
  };
}

async function updateExchangeRateConfig(configData) {
  // This would update exchange rate configuration in the database
  // For now, return mock data
  return {
    ...configData,
    updatedAt: new Date().toISOString()
  };
}

function getMockRate(fromCurrency, toCurrency) {
  // Mock exchange rates for demonstration
  const rates = {
    'USD': { 'EUR': 0.85, 'GBP': 0.73, 'XOF': 550, 'XAF': 550 },
    'EUR': { 'USD': 1.18, 'GBP': 0.86, 'XOF': 647, 'XAF': 647 },
    'GBP': { 'USD': 1.37, 'EUR': 1.16, 'XOF': 753, 'XAF': 753 },
    'XOF': { 'USD': 0.0018, 'EUR': 0.0015, 'GBP': 0.0013 },
    'XAF': { 'USD': 0.0018, 'EUR': 0.0015, 'GBP': 0.0013 }
  };

  if (fromCurrency === toCurrency) return 1;
  return rates[fromCurrency]?.[toCurrency] || 1;
}

module.exports = router;
