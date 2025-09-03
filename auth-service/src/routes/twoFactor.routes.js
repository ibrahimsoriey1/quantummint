const express = require('express');
const { body } = require('express-validator');
const twoFactorController = require('../controllers/twoFactor.controller');
const { validateRequest } = require('../middleware/validateRequest');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();

// Generate 2FA setup
router.get('/setup', authenticate, twoFactorController.generateSetup);

// Verify and enable 2FA
router.post(
  '/enable',
  authenticate,
  [
    body('token').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Please provide a valid 6-digit token'),
    validateRequest
  ],
  twoFactorController.enableTwoFactor
);

// Verify 2FA token during login
router.post(
  '/verify',
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('token').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Please provide a valid 6-digit token'),
    validateRequest
  ],
  twoFactorController.verifyToken
);

// Disable 2FA
router.post(
  '/disable',
  authenticate,
  [
    body('token').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Please provide a valid 6-digit token'),
    validateRequest
  ],
  twoFactorController.disableTwoFactor
);

// Generate backup codes
router.get('/backup-codes', authenticate, twoFactorController.generateBackupCodes);

module.exports = router;