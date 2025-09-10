const express = require('express');
const { validate } = require('../../../shared/utils/validation');
const { schemas } = require('../../../shared/utils/validation');
const { authenticate, authorize } = require('../middleware/auth');
const {
  updateProfile,
  changePassword,
  deleteAccount,
  getUserById,
  getAllUsers
} = require('../controllers/userController');

const router = express.Router();

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authenticate, validate(schemas.userUpdate), updateProfile);

// @route   PUT /api/users/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', authenticate, validate(schemas.passwordChange), changePassword);

// @route   DELETE /api/users/account
// @desc    Delete user account
// @access  Private
router.delete('/account', authenticate, deleteAccount);

// @route   GET /api/users/:id
// @desc    Get user by ID (admin only)
// @access  Private (Admin)
router.get('/:id', authenticate, authorize('admin'), getUserById);

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Private (Admin)
router.get('/', authenticate, authorize('admin'), validate(schemas.pagination, 'query'), getAllUsers);

module.exports = router;
