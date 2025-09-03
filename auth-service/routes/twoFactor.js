const express = require('express');
const { body, validationResult } = require('express-validator');
const twoFactorController = require('../controllers/twoFactorController');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

const router = express.Router();

// Validation rules
const enable2FAValidation = [
  body('secret')
    .notEmpty()
    .withMessage('Secret is required'),
  body('token')
    .isLength({ min: 6, max: 6 })
    .matches(/^\d+$/)
    .withMessage('Token must be exactly 6 digits')
];

const verify2FAValidation = [
  body('token')
    .isLength({ min: 6, max: 6 })
    .matches(/^\d+$/)
    .withMessage('Token must be exactly 6 digits')
];

const disable2FAValidation = [
  body('token')
    .isLength({ min: 6, max: 6 })
    .matches(/^\d+$/)
    .withMessage('Token must be exactly 6 digits'),
  body('password')
    .notEmpty()
    .withMessage('Password is required for security verification')
];

const backupCodesValidation = [
  body('token')
    .isLength({ min: 6, max: 6 })
    .matches(/^\d+$/)
    .withMessage('Token must be exactly 6 digits')
];

// All routes require authentication
router.use(authenticateToken);

// Routes

/**
 * @route   POST /api/v1/2fa/setup
 * @desc    Generate 2FA secret and QR code
 * @access  Private
 */
router.post('/setup', twoFactorController.setup2FA);

/**
 * @route   POST /api/v1/2fa/enable
 * @desc    Enable 2FA with verification token
 * @access  Private
 */
router.post('/enable', enable2FAValidation, validateRequest, twoFactorController.enable2FA);

/**
 * @route   POST /api/v1/2fa/verify
 * @desc    Verify 2FA token
 * @access  Private
 */
router.post('/verify', verify2FAValidation, validateRequest, twoFactorController.verify2FA);

/**
 * @route   POST /api/v1/2fa/disable
 * @desc    Disable 2FA
 * @access  Private
 */
router.post('/disable', disable2FAValidation, validateRequest, twoFactorController.disable2FA);

/**
 * @route   GET /api/v1/2fa/status
 * @desc    Get 2FA status
 * @access  Private
 */
router.get('/status', twoFactorController.get2FAStatus);

/**
 * @route   POST /api/v1/2fa/backup-codes
 * @desc    Generate backup codes
 * @access  Private
 */
router.post('/backup-codes', backupCodesValidation, validateRequest, twoFactorController.generateBackupCodes);

/**
 * @route   GET /api/v1/2fa/backup-codes
 * @desc    Get backup codes
 * @access  Private
 */
router.get('/backup-codes', twoFactorController.getBackupCodes);

/**
 * @route   POST /api/v1/2fa/regenerate-backup-codes
 * @desc    Regenerate backup codes
 * @access  Private
 */
router.post('/regenerate-backup-codes', backupCodesValidation, validateRequest, twoFactorController.regenerateBackupCodes);

/**
 * @route   POST /api/v1/2fa/verify-backup-code
 * @desc    Verify backup code
 * @access  Private
 */
router.post('/verify-backup-code', twoFactorController.verifyBackupCode);

/**
 * @route   POST /api/v1/2fa/reset
 * @desc    Reset 2FA (admin only, for account recovery)
 * @access  Private (Admin)
 */
router.post('/reset', twoFactorController.reset2FA);

module.exports = router;
