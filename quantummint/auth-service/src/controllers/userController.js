const User = require('../../../shared/models/User');
const Wallet = require('../../../shared/models/Wallet');
const logger = require('../../../shared/utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');

// Update user profile
const updateProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName, phoneNumber, dateOfBirth, preferences } = req.body;

  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Update fields if provided
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (phoneNumber) user.phoneNumber = phoneNumber;
  if (dateOfBirth) user.dateOfBirth = dateOfBirth;
  if (preferences) {
    user.preferences = { ...user.preferences, ...preferences };
  }

  await user.save();

  logger.info('User profile updated', {
    userId: user._id,
    email: user.email,
    updatedFields: Object.keys(req.body)
  });

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        dateOfBirth: user.dateOfBirth,
        preferences: user.preferences,
        updatedAt: user.updatedAt
      }
    }
  });
});

// Change password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id).select('+password');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Verify current password
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);

  if (!isCurrentPasswordValid) {
    return res.status(400).json({
      success: false,
      message: 'Current password is incorrect'
    });
  }

  // Update password
  user.password = newPassword;
  await user.save();

  logger.info('User password changed', {
    userId: user._id,
    email: user.email
  });

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
});

// Delete user account
const deleteAccount = asyncHandler(async (req, res) => {
  const { password } = req.body;

  const user = await User.findById(req.user.id).select('+password');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    return res.status(400).json({
      success: false,
      message: 'Invalid password'
    });
  }

  // Check if user has balance in wallet
  const wallet = await Wallet.findOne({ userId: user._id });
  if (wallet && wallet.balance > 0) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete account with remaining balance. Please withdraw all funds first.'
    });
  }

  // Soft delete - deactivate account instead of hard delete
  user.isActive = false;
  user.email = `deleted_${Date.now()}_${user.email}`;
  user.username = `deleted_${Date.now()}_${user.username}`;
  await user.save();

  // Deactivate wallet
  if (wallet) {
    wallet.isActive = false;
    await wallet.save();
  }

  logger.info('User account deleted', {
    userId: user._id,
    originalEmail: req.user.email
  });

  res.json({
    success: true,
    message: 'Account deleted successfully'
  });
});

// Get user by ID (Admin only)
const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  const wallet = await Wallet.findOne({ userId: id });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        dateOfBirth: user.dateOfBirth,
        role: user.role,
        isActive: user.isActive,
        isVerified: user.isVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        lastLoginAt: user.lastLoginAt,
        lastLoginIP: user.lastLoginIP,
        loginAttempts: user.loginAttempts,
        isLocked: user.isLocked,
        preferences: user.preferences,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      wallet: wallet ? {
        id: wallet._id,
        balance: wallet.balance,
        currency: wallet.currency,
        isActive: wallet.isActive,
        isFrozen: wallet.isFrozen,
        frozenReason: wallet.frozenReason,
        dailyLimit: wallet.dailyLimit,
        monthlyLimit: wallet.monthlyLimit,
        totalGenerated: wallet.totalGenerated,
        totalSpent: wallet.totalSpent,
        totalReceived: wallet.totalReceived,
        createdAt: wallet.createdAt
      } : null
    }
  });
});

// Get all users (Admin only)
const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const users = await User.find()
    .select('-password -twoFactorSecret -passwordResetToken -emailVerificationToken')
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));

  const total = await User.countDocuments();

  // Get wallet info for each user
  const usersWithWallets = await Promise.all(
    users.map(async (user) => {
      const wallet = await Wallet.findOne({ userId: user._id });
      return {
        user: user.toObject(),
        wallet: wallet ? {
          id: wallet._id,
          balance: wallet.balance,
          currency: wallet.currency,
          isActive: wallet.isActive,
          isFrozen: wallet.isFrozen
        } : null
      };
    })
  );

  res.json({
    success: true,
    data: {
      users: usersWithWallets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

module.exports = {
  updateProfile,
  changePassword,
  deleteAccount,
  getUserById,
  getAllUsers
};
