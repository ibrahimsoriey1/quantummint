const express = require('express');
const { body, query, param } = require('express-validator');
const kycController = require('../controllers/kyc.controller');
const { validateRequest } = require('../middleware/validateRequest');
const { authenticate, authenticateService } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

// Create or update KYC profile
router.post(
  '/profile',
  authenticate,
  [
    body('personalInfo')
      .isObject()
      .withMessage('Personal information is required'),
    body('personalInfo.firstName')
      .notEmpty()
      .withMessage('First name is required'),
    body('personalInfo.lastName')
      .notEmpty()
      .withMessage('Last name is required'),
    body('personalInfo.dateOfBirth')
      .isISO8601()
      .withMessage('Valid date of birth is required'),
    body('personalInfo.nationality')
      .notEmpty()
      .withMessage('Nationality is required'),
    body('contactInfo')
      .isObject()
      .withMessage('Contact information is required'),
    body('contactInfo.email')
      .isEmail()
      .withMessage('Valid email is required'),
    body('contactInfo.phoneNumber')
      .notEmpty()
      .withMessage('Phone number is required'),
    body('contactInfo.address.country')
      .notEmpty()
      .withMessage('Country is required'),
    validateRequest
  ],
  kycController.createOrUpdateKycProfile
);

// Get KYC profile
router.get(
  '/profile',
  authenticate,
  kycController.getKycProfile
);

// Check KYC status
router.get(
  '/status',
  authenticate,
  kycController.checkKycStatus
);

// Verify KYC level (service to service)
router.get(
  '/verify/:userId',
  authenticateService,
  [
    param('userId')
      .notEmpty()
      .withMessage('User ID is required'),
    validateRequest
  ],
  kycController.verifyKycLevel
);

// Admin routes
// Update KYC tier (admin only)
router.put(
  '/tier/:userId',
  authenticate,
  authorize(['admin', 'super_admin']),
  [
    param('userId')
      .notEmpty()
      .withMessage('User ID is required'),
    body('tier')
      .isIn(['none', 'tier_1', 'tier_2', 'tier_3'])
      .withMessage('Invalid tier'),
    validateRequest
  ],
  kycController.updateKycTier
);

// Get KYC profile by user ID (admin only)
router.get(
  '/admin/profile/:userId',
  authenticate,
  authorize(['admin', 'super_admin']),
  [
    param('userId')
      .notEmpty()
      .withMessage('User ID is required'),
    validateRequest
  ],
  kycController.getKycProfileByUserId
);

// Get all KYC profiles (admin only)
router.get(
  '/admin/profiles',
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
      .isIn(['pending', 'approved', 'rejected', 'expired'])
      .withMessage('Invalid status'),
    query('tier')
      .optional()
      .isIn(['none', 'tier_1', 'tier_2', 'tier_3'])
      .withMessage('Invalid tier'),
    validateRequest
  ],
  kycController.getAllKycProfiles
);

// Get KYC statistics (admin only)
router.get(
  '/admin/statistics',
  authenticate,
  authorize(['admin', 'super_admin']),
  kycController.getKycStatistics
);

module.exports = router;