const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { authenticateToken, requireOwnership } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const generationService = require('../services/generationService');
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

// POST /api/v1/generation - Start money generation
router.post('/', [
  body('amount')
    .isFloat({ min: 0.01, max: 1000000 })
    .withMessage('Amount must be between 0.01 and 1,000,000'),
  body('currency')
    .isIn(['USD', 'EUR', 'GBP', 'XAF', 'XOF', 'BTC', 'ETH', 'QMT'])
    .withMessage('Invalid currency'),
  body('algorithm')
    .optional()
    .isIn(['quantum', 'cryptographic', 'mathematical', 'hybrid'])
    .withMessage('Invalid algorithm'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { amount, currency, algorithm } = req.body;
  const userId = req.user.id;

  logger.generation(`Generation request received from user ${userId}`, {
    userId,
    amount,
    currency,
    algorithm: algorithm || 'auto'
  });

  const result = await generationService.generateMoney(
    userId,
    amount,
    currency,
    algorithm,
    {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      location: req.body.location,
      device: req.body.device
    }
  );

  res.status(201).json({
    success: true,
    message: 'Money generation started successfully',
    data: result
  });
}));

// GET /api/v1/generation - Get user's generation history
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
    .isIn(['pending', 'processing', 'completed', 'failed', 'cancelled'])
    .withMessage('Invalid status'),
  query('algorithm')
    .optional()
    .isIn(['quantum', 'cryptographic', 'mathematical', 'hybrid'])
    .withMessage('Invalid algorithm'),
  query('currency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP', 'XAF', 'XOF', 'BTC', 'ETH', 'QMT'])
    .withMessage('Invalid currency'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  validateRequest
], asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const options = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 20,
    status: req.query.status,
    algorithm: req.query.algorithm,
    currency: req.query.currency,
    startDate: req.query.startDate,
    endDate: req.query.endDate
  };

  const result = await generationService.getUserGenerations(userId, options);

  res.json({
    success: true,
    data: result.generations,
    pagination: result.pagination
  });
}));

// GET /api/v1/generation/:id - Get specific generation details
router.get('/:id', [
  param('id')
    .isMongoId()
    .withMessage('Invalid generation ID'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const generation = await generationService.getGenerationById(id, userId);

  res.json({
    success: true,
    data: generation
  });
}));

// POST /api/v1/generation/:id/cancel - Cancel pending generation
router.post('/:id/cancel', [
  param('id')
    .isMongoId()
    .withMessage('Invalid generation ID'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const result = await generationService.cancelGeneration(id, userId);

  res.json({
    success: true,
    message: result.message
  });
}));

// GET /api/v1/generation/stats/overview - Get generation statistics overview
router.get('/stats/overview', [
  query('period')
    .optional()
    .isIn(['day', 'week', 'month', 'year'])
    .withMessage('Period must be day, week, month, or year'),
  validateRequest
], asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const period = req.query.period || 'month';

  const stats = await generationService.getGenerationStats(userId, period);

  res.json({
    success: true,
    data: {
      period,
      stats
    }
  });
}));

// GET /api/v1/generation/stats/detailed - Get detailed generation statistics
router.get('/stats/detailed', [
  query('startDate')
    .isISO8601()
    .withMessage('Start date is required and must be a valid ISO 8601 date'),
  query('endDate')
    .isISO8601()
    .withMessage('End date is required and must be a valid ISO 8601 date'),
  query('groupBy')
    .optional()
    .isIn(['day', 'week', 'month', 'algorithm', 'currency'])
    .withMessage('Group by must be day, week, month, algorithm, or currency'),
  validateRequest
], asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { startDate, endDate, groupBy = 'day' } = req.query;

  const stats = await generationService.getDetailedStats(
    userId,
    startDate,
    endDate,
    groupBy
  );

  res.json({
    success: true,
    data: {
      startDate,
      endDate,
      groupBy,
      stats
    }
  });
}));

// POST /api/v1/generation/bulk - Bulk generation (admin only)
router.post('/bulk', [
  body('generations')
    .isArray({ min: 1, max: 100 })
    .withMessage('Generations must be an array with 1-100 items'),
  body('generations.*.userId')
    .isMongoId()
    .withMessage('Invalid user ID'),
  body('generations.*.amount')
    .isFloat({ min: 0.01, max: 1000000 })
    .withMessage('Amount must be between 0.01 and 1,000,000'),
  body('generations.*.currency')
    .isIn(['USD', 'EUR', 'GBP', 'XAF', 'XOF', 'BTC', 'ETH', 'QMT'])
    .withMessage('Invalid currency'),
  body('generations.*.algorithm')
    .optional()
    .isIn(['quantum', 'cryptographic', 'mathematical', 'hybrid'])
    .withMessage('Invalid algorithm'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { generations } = req.body;

  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required for bulk operations',
      code: 'ADMIN_ACCESS_REQUIRED'
    });
  }

  const results = await generationService.bulkGenerate(generations);

  res.status(201).json({
    success: true,
    message: 'Bulk generation completed',
    data: {
      total: generations.length,
      successful: results.successful.length,
      failed: results.failed.length,
      results: results
    }
  });
}));

// GET /api/v1/generation/status/:id - Get generation status
router.get('/status/:id', [
  param('id')
    .isMongoId()
    .withMessage('Invalid generation ID'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const status = await generationService.getGenerationStatus(id, userId);

  res.json({
    success: true,
    data: status
  });
}));

// POST /api/v1/generation/:id/retry - Retry failed generation
router.post('/:id/retry', [
  param('id')
    .isMongoId()
    .withMessage('Invalid generation ID'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const result = await generationService.retryGeneration(id, userId);

  res.json({
    success: true,
    message: 'Generation retry initiated',
    data: result
  });
}));

// GET /api/v1/generation/limits - Get user's generation limits
router.get('/limits', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const currency = req.query.currency || 'USD';

  const limits = await generationService.getUserLimits(userId, currency);

  res.json({
    success: true,
    data: limits
  });
}));

// POST /api/v1/generation/limits/request - Request limit increase
router.post('/limits/request', [
  body('currency')
    .isIn(['USD', 'EUR', 'GBP', 'XAF', 'XOF', 'BTC', 'ETH', 'QMT'])
    .withMessage('Invalid currency'),
  body('requestedDaily')
    .optional()
    .isFloat({ min: 1000, max: 100000 })
    .withMessage('Daily limit must be between 1,000 and 100,000'),
  body('requestedMonthly')
    .optional()
    .isFloat({ min: 10000, max: 1000000 })
    .withMessage('Monthly limit must be between 10,000 and 1,000,000'),
  body('reason')
    .isLength({ min: 10, max: 500 })
    .withMessage('Reason must be between 10 and 500 characters'),
  validateRequest
], asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { currency, requestedDaily, requestedMonthly, reason } = req.body;

  const result = await generationService.requestLimitIncrease(
    userId,
    currency,
    { requestedDaily, requestedMonthly },
    reason
  );

  res.status(201).json({
    success: true,
    message: 'Limit increase request submitted',
    data: result
  });
}));

module.exports = router;
