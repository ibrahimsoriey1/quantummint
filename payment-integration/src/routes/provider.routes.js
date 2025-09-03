const express = require('express');
const { body, param } = require('express-validator');
const providerController = require('../controllers/provider.controller');
const { validateRequest } = require('../middleware/validateRequest');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { 
  cacheMiddleware, 
  cacheProviderConfig, 
  getCachedProviderConfig 
} = require('../config/redis');

const router = express.Router();

// Get active providers (public) - cache for 1 hour (3600 seconds)
router.get('/active', cacheMiddleware(3600), providerController.getActiveProviders);

// Get provider by code (public) - cache for 1 hour (3600 seconds)
router.get(
  '/:code',
  [
    param('code')
      .isIn(['stripe', 'orange_money', 'afrimoney'])
      .withMessage('Invalid provider code'),
    validateRequest
  ],
  cacheMiddleware(3600),
  providerController.getProviderByCode
);

// Get provider fee structure (public) - cache for 1 hour (3600 seconds)
router.get(
  '/:code/fee-structure',
  [
    param('code')
      .isIn(['stripe', 'orange_money', 'afrimoney'])
      .withMessage('Invalid provider code'),
    validateRequest
  ],
  cacheMiddleware(3600),
  providerController.getProviderFeeStructure
);

// Calculate provider fee (public) - cache for 10 minutes (600 seconds)
router.post(
  '/:code/calculate-fee',
  [
    param('code')
      .isIn(['stripe', 'orange_money', 'afrimoney'])
      .withMessage('Invalid provider code'),
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be at least 0.01'),
    body('currency')
      .optional()
      .isString()
      .isLength({ min: 3, max: 3 })
      .withMessage('Currency must be a 3-letter code'),
    validateRequest
  ],
  cacheMiddleware(600),
  providerController.calculateProviderFee
);

// Admin routes
// Initialize providers (admin only)
router.post(
  '/initialize',
  authenticate,
  authorize(['admin', 'super_admin']),
  async (req, res, next) => {
    // This will invalidate all provider caches after initialization
    req.clearProviderCache = true;
    next();
  },
  providerController.initializeProviders
);

// Get all providers (admin only) - cache for 5 minutes (300 seconds)
router.get(
  '/',
  authenticate,
  authorize(['admin', 'super_admin']),
  cacheMiddleware(300),
  providerController.getAllProviders
);

// Create provider (admin only)
router.post(
  '/',
  authenticate,
  authorize(['admin', 'super_admin']),
  [
    body('name')
      .isString()
      .withMessage('Name is required'),
    body('code')
      .isIn(['stripe', 'orange_money', 'afrimoney'])
      .withMessage('Invalid provider code'),
    body('type')
      .optional()
      .isIn(['payment', 'withdrawal', 'both'])
      .withMessage('Invalid provider type'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
    body('supportedCountries')
      .optional()
      .isArray()
      .withMessage('Supported countries must be an array'),
    body('supportedCurrencies')
      .optional()
      .isArray()
      .withMessage('Supported currencies must be an array'),
    body('minAmount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Minimum amount must be a non-negative number'),
    body('maxAmount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Maximum amount must be a non-negative number'),
    body('feeStructure')
      .optional()
      .isObject()
      .withMessage('Fee structure must be an object'),
    body('requiredKycLevel')
      .optional()
      .isIn(['none', 'tier_1', 'tier_2', 'tier_3'])
      .withMessage('Invalid KYC level'),
    validateRequest
  ],
  async (req, res, next) => {
    // This will invalidate provider cache after creation
    req.clearProviderCache = true;
    next();
  },
  providerController.createProvider
);

// Update provider (admin only)
router.put(
  '/:code',
  authenticate,
  authorize(['admin', 'super_admin']),
  [
    param('code')
      .isIn(['stripe', 'orange_money', 'afrimoney'])
      .withMessage('Invalid provider code'),
    body('name')
      .optional()
      .isString()
      .withMessage('Name must be a string'),
    body('type')
      .optional()
      .isIn(['payment', 'withdrawal', 'both'])
      .withMessage('Invalid provider type'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
    body('supportedCountries')
      .optional()
      .isArray()
      .withMessage('Supported countries must be an array'),
    body('supportedCurrencies')
      .optional()
      .isArray()
      .withMessage('Supported currencies must be an array'),
    body('minAmount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Minimum amount must be a non-negative number'),
    body('maxAmount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Maximum amount must be a non-negative number'),
    body('feeStructure')
      .optional()
      .isObject()
      .withMessage('Fee structure must be an object'),
    body('requiredKycLevel')
      .optional()
      .isIn(['none', 'tier_1', 'tier_2', 'tier_3'])
      .withMessage('Invalid KYC level'),
    validateRequest
  ],
  async (req, res, next) => {
    // This will invalidate provider cache after update
    req.clearProviderCache = true;
    req.providerCode = req.params.code;
    next();
  },
  providerController.updateProvider
);

// Delete provider (admin only)
router.delete(
  '/:code',
  authenticate,
  authorize(['super_admin']),
  [
    param('code')
      .isIn(['stripe', 'orange_money', 'afrimoney'])
      .withMessage('Invalid provider code'),
    validateRequest
  ],
  async (req, res, next) => {
    // This will invalidate provider cache after deletion
    req.clearProviderCache = true;
    req.providerCode = req.params.code;
    next();
  },
  providerController.deleteProvider
);

// Toggle provider status (admin only)
router.patch(
  '/:code/toggle-status',
  authenticate,
  authorize(['admin', 'super_admin']),
  [
    param('code')
      .isIn(['stripe', 'orange_money', 'afrimoney'])
      .withMessage('Invalid provider code'),
    validateRequest
  ],
  async (req, res, next) => {
    // This will invalidate provider cache after status toggle
    req.clearProviderCache = true;
    req.providerCode = req.params.code;
    next();
  },
  providerController.toggleProviderStatus
);

module.exports = router;