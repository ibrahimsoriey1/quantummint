const express = require('express');
const { body, query, param } = require('express-validator');
const adminController = require('../controllers/admin.controller');
const { validateRequest } = require('../middleware/validation.middleware');
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication and admin role
router.use(verifyToken, isAdmin);

/**
 * @route GET /api/admin/users
 * @desc Get all users (with pagination and filters)
 * @access Admin
 */
router.get(
  '/users',
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
      .isIn(['active', 'inactive', 'suspended', 'pending'])
      .withMessage('Status must be active, inactive, suspended, or pending'),
    query('search')
      .optional()
      .isString()
  ],
  validateRequest,
  adminController.getAllUsers
);

/**
 * @route GET /api/admin/users/:userId
 * @desc Get user details
 * @access Admin
 */
router.get(
  '/users/:userId',
  [
    param('userId')
      .isMongoId()
      .withMessage('Invalid user ID format')
  ],
  validateRequest,
  adminController.getUserDetails
);

/**
 * @route PUT /api/admin/users/:userId/status
 * @desc Update user status
 * @access Admin
 */
router.put(
  '/users/:userId/status',
  [
    param('userId')
      .isMongoId()
      .withMessage('Invalid user ID format'),
    body('status')
      .isString()
      .isIn(['active', 'inactive', 'suspended'])
      .withMessage('Status must be active, inactive, or suspended'),
    body('reason')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Reason is required')
  ],
  validateRequest,
  adminController.updateUserStatus
);

/**
 * @route PUT /api/admin/kyc/:verificationId/review
 * @desc Review KYC submission
 * @access Admin
 */
router.put(
  '/kyc/:verificationId/review',
  [
    param('verificationId')
      .isMongoId()
      .withMessage('Invalid verification ID format'),
    body('status')
      .isString()
      .isIn(['verified', 'rejected'])
      .withMessage('Status must be verified or rejected'),
    body('notes')
      .optional()
      .isString(),
    body('rejectionReason')
      .if(body('status').equals('rejected'))
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Rejection reason is required when rejecting KYC')
  ],
  validateRequest,
  adminController.reviewKYC
);

/**
 * @route GET /api/admin/statistics
 * @desc Get system statistics
 * @access Admin
 */
router.get(
  '/statistics',
  [
    query('period')
      .optional()
      .isIn(['daily', 'weekly', 'monthly', 'yearly'])
      .withMessage('Period must be daily, weekly, monthly, or yearly')
  ],
  validateRequest,
  adminController.getStatistics
);

module.exports = router;