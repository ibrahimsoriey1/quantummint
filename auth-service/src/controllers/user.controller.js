const User = require('../models/user.model');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const { sendSMS } = require('../utils/sms');

/**
 * Get current user profile
 * @route GET /api/users/profile
 */
exports.getCurrentUser = async (req, res, next) => {
  try {
    const user = req.user;
    
    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        kycLevel: user.kycLevel,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    logger.error(`Get current user error: ${error.message}`);
    next(error);
  }
};

/**
 * Update user profile
 * @route PUT /api/users/profile
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, phoneNumber } = req.body;
    
    // Update user
    const user = req.user;
    
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    
    // If phone number is changed, reset verification
    if (phoneNumber && phoneNumber !== user.phoneNumber) {
      user.phoneNumber = phoneNumber;
      user.isPhoneVerified = false;
    }
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified
      }
    });
  } catch (error) {
    logger.error(`Update profile error: ${error.message}`);
    next(error);
  }
};

/**
 * Change password
 * @route PUT /api/users/change-password
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Get user with password
    const user = await User.findById(req.user._id).select('+password');
    
    // Check current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isPasswordValid) {
      return next(new ApiError(401, 'Current password is incorrect'));
    }
    
    // Update password
    user.password = newPassword;
    
    // Clear all refresh tokens for security
    user.refreshTokens = [];
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please log in again with your new password.'
    });
  } catch (error) {
    logger.error(`Change password error: ${error.message}`);
    next(error);
  }
};

/**
 * Initiate phone verification
 * @route POST /api/users/verify-phone
 */
exports.initiatePhoneVerification = async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;
    
    // Update user's phone number if provided
    const user = req.user;
    if (phoneNumber && phoneNumber !== user.phoneNumber) {
      user.phoneNumber = phoneNumber;
      user.isPhoneVerified = false;
      await user.save();
    }
    
    if (!user.phoneNumber) {
      return next(new ApiError(400, 'Phone number is required'));
    }
    
    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store verification code in Redis (in a real implementation)
    // For now, we'll just log it
    logger.info(`Phone verification code for ${user.phoneNumber}: ${verificationCode}`);
    
    // Send SMS
    try {
      await sendSMS({
        to: user.phoneNumber,
        message: `Your QuantumMint verification code is: ${verificationCode}`
      });
      
      res.status(200).json({
        success: true,
        message: 'Verification code sent successfully'
      });
    } catch (error) {
      logger.error(`Failed to send SMS: ${error.message}`);
      return next(new ApiError(500, 'Failed to send verification code'));
    }
  } catch (error) {
    logger.error(`Initiate phone verification error: ${error.message}`);
    next(error);
  }
};

/**
 * Confirm phone verification
 * @route POST /api/users/confirm-phone
 */
exports.confirmPhoneVerification = async (req, res, next) => {
  try {
    const { verificationCode } = req.body;
    
    // In a real implementation, we would verify the code against what's stored in Redis
    // For now, we'll just accept any 6-digit code for demonstration purposes
    if (verificationCode.length !== 6) {
      return next(new ApiError(400, 'Invalid verification code'));
    }
    
    // Update user
    const user = req.user;
    user.isPhoneVerified = true;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Phone number verified successfully'
    });
  } catch (error) {
    logger.error(`Confirm phone verification error: ${error.message}`);
    next(error);
  }
};

/**
 * Get all users (admin only)
 * @route GET /api/users
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    
    // Filtering
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.kycLevel) filter.kycLevel = req.query.kycLevel;
    if (req.query.isEmailVerified) filter.isEmailVerified = req.query.isEmailVerified === 'true';
    if (req.query.isPhoneVerified) filter.isPhoneVerified = req.query.isPhoneVerified === 'true';
    
    // Search
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex }
      ];
    }
    
    // Get users
    const users = await User.find(filter)
      .select('-refreshTokens')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count
    const total = await User.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error(`Get all users error: ${error.message}`);
    next(error);
  }
};

/**
 * Get user by ID (admin only)
 * @route GET /api/users/:id
 */
exports.getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id).select('-refreshTokens');
    
    if (!user) {
      return next(new ApiError(404, 'User not found'));
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error(`Get user by ID error: ${error.message}`);
    next(error);
  }
};

/**
 * Update user (admin only)
 * @route PUT /api/users/:id
 */
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, role, kycLevel } = req.body;
    
    const user = await User.findById(id);
    
    if (!user) {
      return next(new ApiError(404, 'User not found'));
    }
    
    // Super admin role can only be assigned by another super admin
    if (role === 'super_admin' && req.user.role !== 'super_admin') {
      return next(new ApiError(403, 'Only super admins can assign super admin role'));
    }
    
    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email && email !== user.email) {
      user.email = email;
      user.isEmailVerified = false;
    }
    if (role) user.role = role;
    if (kycLevel) user.kycLevel = kycLevel;
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        kycLevel: user.kycLevel
      }
    });
  } catch (error) {
    logger.error(`Update user error: ${error.message}`);
    next(error);
  }
};

/**
 * Delete user (admin only)
 * @route DELETE /api/users/:id
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Prevent deleting super admin
    const user = await User.findById(id);
    
    if (!user) {
      return next(new ApiError(404, 'User not found'));
    }
    
    if (user.role === 'super_admin') {
      return next(new ApiError(403, 'Super admin users cannot be deleted'));
    }
    
    await User.findByIdAndDelete(id);
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    logger.error(`Delete user error: ${error.message}`);
    next(error);
  }
};