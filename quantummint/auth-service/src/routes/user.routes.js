const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/user.controller');
const { validateRequest } = require('../middleware/validation.middleware');
const { verifyToken } = require('../middleware/auth.middleware');
const { uploadKYCDocuments } = require('../middleware/upload.middleware');

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

/**
 * @route GET /api/users/profile
 * @desc Get user profile
 * @access Private
 */
router.get('/profile', userController.getProfile);

/**
 * @route PUT /api/users/profile
 * @desc Update user profile
 * @access Private
 */
router.put(
  '/profile',
  [
    body('firstName')
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage('First name cannot be empty'),
    body('lastName')
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Last name cannot be empty'),
    body('phoneNumber')
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Phone number cannot be empty'),
    body('address')
      .optional()
      .isObject()
      .withMessage('Address must be an object'),
    body('address.street')
      .optional()
      .isString()
      .trim(),
    body('address.city')
      .optional()
      .isString()
      .trim(),
    body('address.state')
      .optional()
      .isString()
      .trim(),
    body('address.postalCode')
      .optional()
      .isString()
      .trim(),
    body('address.country')
      .optional()
      .isString()
      .trim()
  ],
  validateRequest,
  userController.updateProfile
);

/**
 * @route POST /api/users/change-password
 * @desc Change user password
 * @access Private
 */
router.post(
  '/change-password',
  [
    body('currentPassword')
      .isString()
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isString()
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
  ],
  validateRequest,
  userController.changePassword
);

/**
 * @route POST /api/users/enable-2fa
 * @desc Enable two-factor authentication
 * @access Private
 */
router.post('/enable-2fa', userController.enableTwoFactor);

/**
 * @route POST /api/users/verify-2fa-setup
 * @desc Verify and complete two-factor authentication setup
 * @access Private
 */
router.post(
  '/verify-2fa-setup',
  [
    body('code')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Verification code is required')
  ],
  validateRequest,
  userController.verifyTwoFactorSetup
);

/**
 * @route POST /api/users/disable-2fa
 * @desc Disable two-factor authentication
 * @access Private
 */
router.post(
  '/disable-2fa',
  [
    body('password')
      .isString()
      .notEmpty()
      .withMessage('Password is required')
  ],
  validateRequest,
  userController.disableTwoFactor
);

/**
 * @route POST /api/users/kyc/submit
 * @desc Submit KYC information
 * @access Private
 */
router.post(
  '/kyc/submit',
  uploadKYCDocuments,
  [
    body('idType')
      .isString()
      .isIn(['passport', 'national_id', 'drivers_license'])
      .withMessage('ID type must be passport, national_id, or drivers_license'),
    body('idNumber')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('ID number is required'),
    body('idExpiryDate')
      .isDate()
      .withMessage('ID expiry date must be a valid date')
  ],
  validateRequest,
  userController.submitKYC
);

/**
 * @route GET /api/users/kyc/status
 * @desc Get KYC verification status
 * @access Private
 */
router.get('/kyc/status', userController.getKYCStatus);

module.exports = router;