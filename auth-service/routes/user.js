const express = require('express');
const { body, validationResult } = require('express-validator');
const userController = require('../controllers/userController');
const { authenticateToken, requireAdmin, requireModerator, requireOwnership } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

const router = express.Router();

// Validation rules
const updateProfileValidation = [
  body('firstName')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .trim(),
  body('lastName')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .trim(),
  body('phone')
    .optional()
    .matches(/^\+?[\d\s-()]+$/)
    .withMessage('Please provide a valid phone number'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date of birth'),
  body('profilePicture')
    .optional()
    .isURL()
    .withMessage('Please provide a valid URL for profile picture'),
  body('preferences.language')
    .optional()
    .isIn(['en', 'fr', 'es', 'de'])
    .withMessage('Language must be one of: en, fr, es, de'),
  body('preferences.timezone')
    .optional()
    .isString()
    .withMessage('Timezone must be a string'),
  body('preferences.notifications.email')
    .optional()
    .isBoolean()
    .withMessage('Email notification preference must be a boolean'),
  body('preferences.notifications.sms')
    .optional()
    .isBoolean()
    .withMessage('SMS notification preference must be a boolean'),
  body('preferences.notifications.push')
    .optional()
    .isBoolean()
    .withMessage('Push notification preference must be a boolean')
];

const updateUserValidation = [
  body('firstName')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .trim(),
  body('lastName')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .trim(),
  body('phone')
    .optional()
    .matches(/^\+?[\d\s-()]+$/)
    .withMessage('Please provide a valid phone number'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date of birth'),
  body('role')
    .optional()
    .isIn(['user', 'moderator', 'admin'])
    .withMessage('Role must be one of: user, moderator, admin'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('isVerified')
    .optional()
    .isBoolean()
    .withMessage('isVerified must be a boolean')
];

const searchValidation = [
  body('query')
    .optional()
    .isString()
    .withMessage('Search query must be a string'),
  body('filters.role')
    .optional()
    .isIn(['user', 'moderator', 'admin'])
    .withMessage('Role filter must be one of: user, moderator, admin'),
  body('filters.isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive filter must be a boolean'),
  body('filters.isVerified')
    .optional()
    .isBoolean()
    .withMessage('isVerified filter must be a boolean'),
  body('filters.dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid ISO date'),
  body('filters.dateTo')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid ISO date'),
  body('pagination.page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  body('pagination.limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

// All routes require authentication
router.use(authenticateToken);

// Routes

/**
 * @route   GET /api/v1/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', userController.getProfile);

/**
 * @route   PUT /api/v1/users/profile
 * @desc    Update current user profile
 * @access  Private
 */
router.put('/profile', updateProfileValidation, validateRequest, userController.updateProfile);

/**
 * @route   DELETE /api/v1/users/profile
 * @desc    Delete current user profile
 * @access  Private
 */
router.delete('/profile', userController.deleteProfile);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get user by ID (admin/moderator only)
 * @access  Private (Admin/Moderator)
 */
router.get('/:id', requireModerator, userController.getUserById);

/**
 * @route   PUT /api/v1/users/:id
 * @desc    Update user by ID (admin/moderator only)
 * @access  Private (Admin/Moderator)
 */
router.put('/:id', requireModerator, updateUserValidation, validateRequest, userController.updateUserById);

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Delete user by ID (admin only)
 * @access  Private (Admin)
 */
router.delete('/:id', requireAdmin, userController.deleteUserById);

/**
 * @route   POST /api/v1/users/search
 * @desc    Search users (admin/moderator only)
 * @access  Private (Admin/Moderator)
 */
router.post('/search', requireModerator, searchValidation, validateRequest, userController.searchUsers);

/**
 * @route   GET /api/v1/users
 * @desc    Get all users with pagination (admin/moderator only)
 * @access  Private (Admin/Moderator)
 */
router.get('/', requireModerator, userController.getAllUsers);

/**
 * @route   POST /api/v1/users/:id/activate
 * @desc    Activate user account (admin/moderator only)
 * @access  Private (Admin/Moderator)
 */
router.post('/:id/activate', requireModerator, userController.activateUser);

/**
 * @route   POST /api/v1/users/:id/deactivate
 * @desc    Deactivate user account (admin/moderator only)
 * @access  Private (Admin/Moderator)
 */
router.post('/:id/deactivate', requireModerator, userController.deactivateUser);

/**
 * @route   POST /api/v1/users/:id/verify
 * @desc    Verify user account (admin/moderator only)
 * @access  Private (Admin/Moderator)
 */
router.post('/:id/verify', requireModerator, userController.verifyUser);

/**
 * @route   POST /api/v1/users/:id/unverify
 * @desc    Unverify user account (admin/moderator only)
 * @access  Private (Admin/Moderator)
 */
router.post('/:id/unverify', requireModerator, userController.unverifyUser);

/**
 * @route   POST /api/v1/users/:id/change-role
 * @desc    Change user role (admin only)
 * @access  Private (Admin)
 */
router.post('/:id/change-role', requireAdmin, userController.changeUserRole);

/**
 * @route   GET /api/v1/users/:id/activity
 * @desc    Get user activity log (admin/moderator only)
 * @access  Private (Admin/Moderator)
 */
router.get('/:id/activity', requireModerator, userController.getUserActivity);

/**
 * @route   POST /api/v1/users/:id/reset-password
 * @desc    Reset user password (admin only)
 * @access  Private (Admin)
 */
router.post('/:id/reset-password', requireAdmin, userController.resetUserPassword);

/**
 * @route   GET /api/v1/users/stats/overview
 * @desc    Get user statistics overview (admin/moderator only)
 * @access  Private (Admin/Moderator)
 */
router.get('/stats/overview', requireModerator, userController.getUserStatsOverview);

/**
 * @route   GET /api/v1/users/stats/registration
 * @desc    Get user registration statistics (admin/moderator only)
 * @access  Private (Admin/Moderator)
 */
router.get('/stats/registration', requireModerator, userController.getUserRegistrationStats);

/**
 * @route   GET /api/v1/users/stats/activity
 * @desc    Get user activity statistics (admin/moderator only)
 * @access  Private (Admin/Moderator)
 */
router.get('/stats/activity', requireModerator, userController.getUserActivityStats);

module.exports = router;
