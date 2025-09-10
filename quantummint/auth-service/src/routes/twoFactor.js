const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  setupTwoFactor,
  verifyTwoFactor,
  disableTwoFactor,
  generateBackupCodes,
  verifyToken
} = require('../controllers/twoFactorController');

const router = express.Router();

// @route   POST /api/2fa/setup
// @desc    Setup two-factor authentication
// @access  Private
router.post('/setup', authenticate, setupTwoFactor);

// @route   POST /api/2fa/verify
// @desc    Verify and enable two-factor authentication
// @access  Private
router.post('/verify', authenticate, verifyTwoFactor);

// @route   POST /api/2fa/disable
// @desc    Disable two-factor authentication
// @access  Private
router.post('/disable', authenticate, disableTwoFactor);

// @route   POST /api/2fa/backup-codes
// @desc    Generate new backup codes
// @access  Private
router.post('/backup-codes', authenticate, generateBackupCodes);

// @route   POST /api/2fa/verify-token
// @desc    Verify 2FA token during login
// @access  Public
router.post('/verify-token', verifyToken);

module.exports = router;
