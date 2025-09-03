const express = require('express');
const { body, query } = require('express-validator');
const generationController = require('../controllers/generation.controller');
const { validateRequest } = require('../middleware/validateRequest');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { cacheMiddleware, clearCache } = require('../config/redis');

const router = express.Router();

// Create generation request
router.post(
  '/',
  authenticate,
  [
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be at least 0.01'),
    body('method')
      .isIn(['standard', 'accelerated', 'premium'])
      .withMessage('Invalid generation method'),
    validateRequest
  ],
  async (req, res, next) => {
    // Clear cache for this user's generations and wallet before creating new generation
    try {
      await clearCache(`*${req.user.id}*`);
      next();
    } catch (error) {
      next(error);
    }
  },
  generationController.createGeneration
);

// Get generation by ID - cache for 5 minutes (300 seconds)
router.get(
  '/:id',
  authenticate,
  cacheMiddleware(300),
  generationController.getGenerationById
);

// Get user generations - cache for 2 minutes (120 seconds)
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
    query('status')
      .optional()
      .isIn(['pending', 'completed', 'failed', 'verified', 'rejected'])
      .withMessage('Invalid status'),
    query('method')
      .optional()
      .isIn(['standard', 'accelerated', 'premium'])
      .withMessage('Invalid method'),
    validateRequest
  ],
  cacheMiddleware(120),
  generationController.getUserGenerations
);

// Admin routes
// Get all generations (admin only) - cache for 1 minute (60 seconds)
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
      .isIn(['pending', 'completed', 'failed', 'verified', 'rejected'])
      .withMessage('Invalid status'),
    query('method')
      .optional()
      .isIn(['standard', 'accelerated', 'premium'])
      .withMessage('Invalid method'),
    query('verificationStatus')
      .optional()
      .isIn(['not_required', 'pending', 'approved', 'rejected'])
      .withMessage('Invalid verification status'),
    validateRequest
  ],
  cacheMiddleware(60),
  generationController.getAllGenerations
);

// Verify generation (admin only)
router.post(
  '/admin/verify/:id',
  authenticate,
  authorize(['admin', 'super_admin']),
  [
    body('approved')
      .isBoolean()
      .withMessage('Approved must be a boolean'),
    body('reason')
      .optional()
      .isString()
      .withMessage('Reason must be a string'),
    validateRequest
  ],
  async (req, res, next) => {
    // Clear cache for all generations and the specific generation
    try {
      await clearCache(`*${req.params.id}*`);
      await clearCache('*admin/all*');
      next();
    } catch (error) {
      next(error);
    }
  },
  generationController.verifyGeneration
);

// Complete generation (internal use only)
router.post(
  '/internal/complete/:id',
  authenticate,
  authorize(['admin', 'super_admin', 'service']),
  async (req, res, next) => {
    // Clear cache for all generations and the specific generation
    try {
      await clearCache(`*${req.params.id}*`);
      await clearCache('*admin/all*');
      next();
    } catch (error) {
      next(error);
    }
  },
  generationController.completeGeneration
);

// Get generation limits - cache for 1 hour (3600 seconds)
router.get(
  '/limits',
  authenticate,
  cacheMiddleware(3600),
  generationController.getGenerationLimits
);

module.exports = router;