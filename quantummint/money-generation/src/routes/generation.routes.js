const express = require('express');
const { body, query, param } = require('express-validator');
const generationController = require('../controllers/generation.controller');
const { validateRequest } = require('../middleware/validation.middleware');
const { verifyToken } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

/**
 * @route POST /api/generate
 * @desc Generate digital money in the user's wallet
 * @access Private
 */
router.post(
  '/',
  [
    body('walletId')
      .isMongoId()
      .withMessage('Invalid wallet ID format'),
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be greater than zero'),
    body('generationMethod')
      .isString()
      .isIn(['standard', 'accelerated', 'premium'])
      .withMessage('Generation method must be standard, accelerated, or premium')
  ],
  validateRequest,
  generationController.generateMoney
);

/**
 * @route POST /api/generate/verify
 * @desc Verify a generation request
 * @access Private
 */
router.post(
  '/verify',
  [
    body('generationId')
      .isMongoId()
      .withMessage('Invalid generation ID format'),
    body('verificationCode')
      .isString()
      .isLength({ min: 6, max: 6 })
      .withMessage('Verification code must be 6 digits')
  ],
  validateRequest,
  generationController.verifyGeneration
);

/**
 * @route GET /api/generate/:generationId
 * @desc Get status of a specific generation request
 * @access Private
 */
router.get(
  '/:generationId',
  [
    param('generationId')
      .isMongoId()
      .withMessage('Invalid generation ID format')
  ],
  validateRequest,
  generationController.getGenerationStatus
);

/**
 * @route GET /api/generate/history
 * @desc Get history of money generation requests
 * @access Private
 */
router.get(
  '/history',
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
      .isIn(['pending', 'completed', 'failed', 'cancelled'])
      .withMessage('Status must be pending, completed, failed, or cancelled'),
    query('startDate')
      .optional()
      .isDate()
      .withMessage('Start date must be a valid date'),
    query('endDate')
      .optional()
      .isDate()
      .withMessage('End date must be a valid date'),
    query('walletId')
      .optional()
      .isMongoId()
      .withMessage('Invalid wallet ID format')
  ],
  validateRequest,
  generationController.getGenerationHistory
);

module.exports = router;