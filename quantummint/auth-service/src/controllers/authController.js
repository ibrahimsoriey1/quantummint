const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const User = require('../../../shared/models/User');
const Wallet = require('../../../shared/models/Wallet');
const logger = require('../../../shared/utils/logger');
const CryptoUtils = require('../../../shared/utils/crypto');
const emailService = require('../../../shared/utils/email');
const { asyncHandler } = require('../middleware/errorHandler');

// Register new user
const register = asyncHandler(async (req, res) => {
  const { email, username, password, firstName, lastName, phoneNumber, dateOfBirth } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { username }]
  });

  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: existingUser.email === email ? 'Email already registered' : 'Username already taken'
    });
  }

  // Create user
  const user = new User({
    email,
    username,
    password,
    firstName,
    lastName,
    phoneNumber,
    dateOfBirth,
    metadata: {
      registrationIP: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  await user.save();

  // Create wallet for user
  const wallet = new Wallet({
    userId: user._id,
    metadata: {
      createdIP: req.ip
    }
  });

  await wallet.save();

  // Generate JWT token
  const token = CryptoUtils.generateJWT(
    { userId: user._id, email: user.email },
    process.env.JWT_SECRET,
    process.env.JWT_EXPIRES_IN
  );

  // Generate refresh token
  const refreshToken = CryptoUtils.generateJWT(
    { userId: user._id, type: 'refresh' },
    process.env.REFRESH_TOKEN_SECRET,
    process.env.REFRESH_TOKEN_EXPIRES_IN
  );

  logger.info('User registered successfully', {
    userId: user._id,
    email: user.email,
    ip: req.ip
  });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isVerified: user.isVerified,
        twoFactorEnabled: user.twoFactorEnabled
      },
      wallet: {
        id: wallet._id,
        balance: wallet.balance,
        currency: wallet.currency
      },
      tokens: {
        accessToken: token,
        refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN
      }
    }
  });
});

// Login user
const login = asyncHandler(async (req, res) => {
  const { email, password, twoFactorCode, rememberMe } = req.body;

  // Find user by email
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Check if account is locked
  if (user.isLocked) {
    return res.status(423).json({
      success: false,
      message: 'Account is temporarily locked due to too many failed login attempts'
    });
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    await user.incLoginAttempts();
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Check if account is active
  if (!user.isActive) {
    return res.status(401).json({
      success: false,
      message: 'Account is deactivated'
    });
  }

  // Check two-factor authentication
  if (user.twoFactorEnabled) {
    if (!twoFactorCode) {
      return res.status(200).json({
        success: true,
        message: 'Two-factor authentication required',
        requiresTwoFactor: true,
        tempToken: CryptoUtils.generateJWT(
          { userId: user._id, temp: true },
          process.env.JWT_SECRET,
          '10m'
        )
      });
    }

    // Verify 2FA code
    const isValidTwoFactor = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: twoFactorCode,
      window: 2
    });

    if (!isValidTwoFactor) {
      // Check backup codes
      const isValidBackupCode = user.useBackupCode(twoFactorCode);
      
      if (!isValidBackupCode) {
        await user.incLoginAttempts();
        return res.status(401).json({
          success: false,
          message: 'Invalid two-factor authentication code'
        });
      }
      
      await user.save();
    }
  }

  // Reset login attempts on successful login
  await user.resetLoginAttempts();

  // Update last login info
  user.lastLoginAt = new Date();
  user.lastLoginIP = req.ip;
  await user.save();

  // Generate tokens
  const expiresIn = rememberMe ? '30d' : process.env.JWT_EXPIRES_IN;
  const token = CryptoUtils.generateJWT(
    { userId: user._id, email: user.email },
    process.env.JWT_SECRET,
    expiresIn
  );

  const refreshToken = CryptoUtils.generateJWT(
    { userId: user._id, type: 'refresh' },
    process.env.REFRESH_TOKEN_SECRET,
    process.env.REFRESH_TOKEN_EXPIRES_IN
  );

  // Get user's wallet
  const wallet = await Wallet.findOne({ userId: user._id });

  logger.info('User logged in successfully', {
    userId: user._id,
    email: user.email,
    ip: req.ip,
    twoFactorUsed: !!twoFactorCode
  });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isVerified: user.isVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        lastLoginAt: user.lastLoginAt
      },
      wallet: wallet ? {
        id: wallet._id,
        balance: wallet.balance,
        currency: wallet.currency
      } : null,
      tokens: {
        accessToken: token,
        refreshToken,
        expiresIn
      }
    }
  });
});

// Refresh access token
const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: 'Refresh token required'
    });
  }

  try {
    const decoded = CryptoUtils.verifyJWT(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Generate new access token
    const newAccessToken = CryptoUtils.generateJWT(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      process.env.JWT_EXPIRES_IN
    );

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken,
        expiresIn: process.env.JWT_EXPIRES_IN
      }
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
});

// Logout user
const logout = asyncHandler(async (req, res) => {
  // In a production environment, you might want to blacklist the token
  // For now, we'll just return a success response
  logger.info('User logged out', {
    userId: req.user?.id,
    ip: req.ip
  });

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Forgot password
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    // Don't reveal if email exists or not
    return res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent'
    });
  }

  // Generate reset token
  const resetToken = CryptoUtils.generateToken();
  user.passwordResetToken = CryptoUtils.hash(resetToken);
  user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await user.save();

  try {
    // Send password reset email
    await emailService.sendPasswordResetEmail(user.email, resetToken, user.firstName);
    
    logger.info('Password reset email sent successfully', {
      userId: user._id,
      email: user.email
    });
  } catch (error) {
    logger.error('Failed to send password reset email', {
      userId: user._id,
      email: user.email,
      error: error.message
    });
    
    // Reset the token fields since email failed
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    
    return res.status(500).json({
      success: false,
      message: 'Failed to send reset email. Please try again later.'
    });
  }

  res.json({
    success: true,
    message: 'If the email exists, a password reset link has been sent'
  });
});

// Reset password
const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  const hashedToken = CryptoUtils.hash(token);

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired reset token'
    });
  }

  // Update password
  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();

  logger.info('Password reset successfully', {
    userId: user._id,
    email: user.email
  });

  res.json({
    success: true,
    message: 'Password reset successfully'
  });
});

// Get current user profile
const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  const wallet = await Wallet.findOne({ userId: req.user.id });

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
        isVerified: user.isVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        preferences: user.preferences,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      },
      wallet: wallet ? {
        id: wallet._id,
        balance: wallet.balance,
        currency: wallet.currency,
        isActive: wallet.isActive,
        isFrozen: wallet.isFrozen
      } : null
    }
  });
});

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  getProfile
};
