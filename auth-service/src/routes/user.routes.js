const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/user.controller');
const { validateRequest } = require('../middleware/validateRequest');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

// Get current user profile
router.get('/profile', authenticate, userController.getCurrentUser);

// Update user profile
router.put(
  '/profile',
  authenticate,
  [
    body('firstName').optional().notEmpty().withMessage('First name cannot be empty'),
    body('lastName').optional().notEmpty().withMessage('Last name cannot be empty'),
    body('phoneNumber').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
    validateRequest
  ],
  userController.updateProfile
);

// Change password
router.put(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
    validateRequest
  ],
  userController.changePassword
);

// Verify phone number
router.post(
  '/verify-phone',
  authenticate,
  [
    body('phoneNumber').isMobilePhone().withMessage('Please provide a valid phone number'),
    validateRequest
  ],
  userController.initiatePhoneVerification
);

// Confirm phone verification
router.post(
  '/confirm-phone',
  authenticate,
  [
    body('verificationCode').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Please provide a valid 6-digit verification code'),
    validateRequest
  ],
  userController.confirmPhoneVerification
);

// Admin routes
// Get all users (admin only)
router.get('/', authenticate, authorize(['admin', 'super_admin']), userController.getAllUsers);

// Get user by ID (admin only)
router.get('/:id', authenticate, authorize(['admin', 'super_admin']), userController.getUserById);

// Update user (admin only)
router.put(
  '/:id',
  authenticate,
  authorize(['admin', 'super_admin']),
  [
    body('firstName').optional().notEmpty().withMessage('First name cannot be empty'),
    body('lastName').optional().notEmpty().withMessage('Last name cannot be empty'),
    body('email').optional().isEmail().withMessage('Please provide a valid email address'),
    body('role').optional().isIn(['user', 'admin', 'super_admin']).withMessage('Invalid role'),
    body('kycLevel').optional().isIn(['none', 'tier_1', 'tier_2', 'tier_3']).withMessage('Invalid KYC level'),
    validateRequest
  ],
  userController.updateUser
);

// Delete user (admin only)
router.delete('/:id', authenticate, authorize(['super_admin']), userController.deleteUser);

module.exports = router;