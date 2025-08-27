const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const { validateRequest } = require('../middleware/validation.middleware');
const { verifyToken } = require('../middleware/auth.middleware');

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post(
  '/register',
  [
    body('username')
      .isString()
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be between 3 and 30 characters'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('password')
      .isString()
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    body('firstName')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('First name is required'),
    body('lastName')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Last name is required'),
    body('phoneNumber')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Phone number is required'),
    body('countryCode')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Country code is required'),
    body('dateOfBirth')
      .isDate()
      .withMessage('Date of birth must be a valid date')
  ],
  validateRequest,
  authController.register
);

/**
 * @route POST /api/auth/verify-email
 * @desc Verify email address
 * @access Public
 */
router.post(
  '/verify-email',
  [
    body('userId')
      .isString()
      .notEmpty()
      .withMessage('User ID is required'),
    body('token')
      .isString()
      .notEmpty()
      .withMessage('Verification token is required')
  ],
  validateRequest,
  authController.verifyEmail
);

/**
 * @route POST /api/auth/login
 * @desc Login user
 * @access Public
 */
router.post(
  '/login',
  [
    body('username')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Username or email is required'),
    body('password')
      .isString()
      .notEmpty()
      .withMessage('Password is required')
  ],
  validateRequest,
  authController.login
);

/**
 * @route POST /api/auth/verify-2fa
 * @desc Verify two-factor authentication
 * @access Public
 */
router.post(
  '/verify-2fa',
  [
    body('userId')
      .isString()
      .notEmpty()
      .withMessage('User ID is required'),
    body('code')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Verification code is required'),
    body('tempToken')
      .isString()
      .notEmpty()
      .withMessage('Temporary token is required')
  ],
  validateRequest,
  authController.verifyTwoFactor
);

/**
 * @route POST /api/auth/refresh-token
 * @desc Refresh access token
 * @access Public
 */
router.post(
  '/refresh-token',
  [
    body('refreshToken')
      .isString()
      .notEmpty()
      .withMessage('Refresh token is required')
  ],
  validateRequest,
  authController.refreshToken
);

/**
 * @route POST /api/auth/logout
 * @desc Logout user
 * @access Private
 */
router.post('/logout', verifyToken, authController.logout);

/**
 * @route POST /api/auth/reset-password-request
 * @desc Request password reset
 * @access Public
 */
router.post(
  '/reset-password-request',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address')
  ],
  validateRequest,
  authController.resetPasswordRequest
);

/**
 * @route POST /api/auth/reset-password
 * @desc Reset password
 * @access Public
 */
router.post(
  '/reset-password',
  [
    body('userId')
      .isString()
      .notEmpty()
      .withMessage('User ID is required'),
    body('token')
      .isString()
      .notEmpty()
      .withMessage('Reset token is required'),
    body('newPassword')
      .isString()
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
  ],
  validateRequest,
  authController.resetPassword
);

module.exports = router;