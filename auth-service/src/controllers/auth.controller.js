const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/user.model');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const { sendEmail } = require('../utils/email');
const { redisClient } = require('../config/redis');
require('dotenv').config();

/**
 * Generate JWT token
 * @param {Object} user - User object
 * @returns {String} JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRATION || '15m' }
  );
};

/**
 * Generate refresh token
 * @param {Object} user - User object
 * @returns {String} Refresh token
 */
const generateRefreshToken = () => {
  return uuidv4();
};

/**
 * Register a new user
 * @route POST /api/auth/register
 */
exports.register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phoneNumber } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new ApiError(409, 'Email is already registered'));
    }
    
    // Create new user
    const user = new User({
      email,
      passwordHash: password, // Use passwordHash field as per updated schema
      firstName,
      lastName,
      phoneNumber
    });
    
    // Generate email verification token
    const verificationToken = user.generateEmailVerificationToken();
    
    // Save user
    await user.save();
    
    // Send verification email
    const verificationUrl = `${req.protocol}://${req.get('host')}/api/auth/verify-email/${verificationToken}`;
    const message = `
      <h1>Email Verification</h1>
      <p>Please verify your email address by clicking the link below:</p>
      <a href="${verificationUrl}" target="_blank">Verify Email</a>
      <p>If you did not request this, please ignore this email.</p>
    `;
    
    try {
      await sendEmail({
        to: user.email,
        subject: 'QuantumMint - Email Verification',
        html: message
      });
      
      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please check your email to verify your account.'
      });
    } catch (error) {
      // If email fails, still create the user but log the error
      logger.error(`Failed to send verification email: ${error.message}`);
      
      res.status(201).json({
        success: true,
        message: 'User registered successfully, but failed to send verification email. Please contact support.'
      });
    }
  } catch (error) {
    logger.error(`Registration error: ${error.message}`);
    next(error);
  }
};

/**
 * Login user
 * @route POST /api/auth/login
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ email }).select('+passwordHash +twoFactorSecret');
    
    // Check if user exists
    if (!user) {
      return next(new ApiError(401, 'Invalid email or password'));
    }
    
    // Check if account is locked
    if (user.accountLocked && user.accountLockedUntil > Date.now()) {
      const remainingTime = Math.ceil((user.accountLockedUntil - Date.now()) / 1000 / 60);
      return next(new ApiError(403, `Your account is temporarily locked. Please try again in ${remainingTime} minutes.`));
    }
    
    // Check password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      // Increment failed login attempts
      user.failedLoginAttempts += 1;
      
      // Lock account after 5 failed attempts
      if (user.failedLoginAttempts >= 5) {
        user.accountLocked = true;
        user.accountLockedUntil = Date.now() + 15 * 60 * 1000; // Lock for 15 minutes
        await user.save();
        
        return next(new ApiError(403, 'Too many failed login attempts. Your account has been temporarily locked for 15 minutes.'));
      }
      
      await user.save();
      return next(new ApiError(401, 'Invalid email or password'));
    }
    
    // Reset failed login attempts
    user.failedLoginAttempts = 0;
    user.accountLocked = false;
    user.accountLockedUntil = null;
    
    // Check if email is verified
    if (!user.isEmailVerified) {
      return next(new ApiError(403, 'Please verify your email address before logging in.'));
    }
    
    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // Save user ID in Redis for 2FA verification
      const twoFactorToken = crypto.randomBytes(32).toString('hex');
      await redisClient.set(`2fa:${twoFactorToken}`, user._id.toString(), 'EX', 300); // Expire in 5 minutes
      
      return res.status(200).json({
        success: true,
        message: 'Two-factor authentication required',
        requiresTwoFactor: true,
        userId: user._id,
        twoFactorToken
      });
    }
    
    // Generate tokens
    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken();
    const refreshTokenExpires = new Date(Date.now() + (parseInt(process.env.JWT_REFRESH_EXPIRATION) || 7 * 24 * 60 * 60 * 1000));
    
    // Save refresh token
    user.addRefreshToken(
      refreshToken,
      refreshTokenExpires,
      req.headers['user-agent'] || 'unknown',
      req.ip
    );
    
    // Update last login
    user.lastLogin = Date.now();
    await user.save();
    
    // Send response
    res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        kycLevel: user.kycLevel
      }
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    next(error);
  }
};

/**
 * Verify access token
 * @route POST /api/auth/verify-token
 */
exports.verifyToken = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return next(new ApiError(400, 'Token is required'));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return next(new ApiError(401, 'Your token has expired. Please log in again.'));
      }
      return next(new ApiError(401, 'Invalid token. Please log in again.'));
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new ApiError(401, 'The user belonging to this token no longer exists.'));
    }

    if (user.accountLocked && user.accountLockedUntil > Date.now()) {
      return next(new ApiError(403, 'Your account is temporarily locked. Please try again later.'));
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        kycLevel: user.kycLevel
      }
    });
  } catch (error) {
    logger.error(`Verify token error: ${error.message}`);
    next(error);
  }
};

/**
 * Verify email
 * @route GET /api/auth/verify-email/:token
 */
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    
    // Hash token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    // Find user with token
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return next(new ApiError(400, 'Invalid or expired verification token'));
    }
    
    // Update user
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Email verified successfully. You can now log in.'
    });
  } catch (error) {
    logger.error(`Email verification error: ${error.message}`);
    next(error);
  }
};

/**
 * Resend verification email
 * @route POST /api/auth/resend-verification
 */
exports.resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      return next(new ApiError(404, 'User not found'));
    }
    
    if (user.isEmailVerified) {
      return next(new ApiError(400, 'Email is already verified'));
    }
    
    // Generate new verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();
    
    // Send verification email
    const verificationUrl = `${req.protocol}://${req.get('host')}/api/auth/verify-email/${verificationToken}`;
    const message = `
      <h1>Email Verification</h1>
      <p>Please verify your email address by clicking the link below:</p>
      <a href="${verificationUrl}" target="_blank">Verify Email</a>
      <p>If you did not request this, please ignore this email.</p>
    `;
    
    try {
      await sendEmail({
        to: user.email,
        subject: 'QuantumMint - Email Verification',
        html: message
      });
      
      res.status(200).json({
        success: true,
        message: 'Verification email sent successfully'
      });
    } catch (error) {
      logger.error(`Failed to send verification email: ${error.message}`);
      return next(new ApiError(500, 'Failed to send verification email'));
    }
  } catch (error) {
    logger.error(`Resend verification error: ${error.message}`);
    next(error);
  }
};

/**
 * Forgot password
 * @route POST /api/auth/forgot-password
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      return next(new ApiError(404, 'User not found'));
    }
    
    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();
    
    // Send reset email
    const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;
    const message = `
      <h1>Password Reset</h1>
      <p>You requested a password reset. Please click the link below to reset your password:</p>
      <a href="${resetUrl}" target="_blank">Reset Password</a>
      <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
      <p>This link will expire in 10 minutes.</p>
    `;
    
    try {
      await sendEmail({
        to: user.email,
        subject: 'QuantumMint - Password Reset',
        html: message
      });
      
      res.status(200).json({
        success: true,
        message: 'Password reset email sent successfully'
      });
    } catch (error) {
      // Reset token if email fails
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      
      logger.error(`Failed to send password reset email: ${error.message}`);
      return next(new ApiError(500, 'Failed to send password reset email'));
    }
  } catch (error) {
    logger.error(`Forgot password error: ${error.message}`);
    next(error);
  }
};

/**
 * Reset password
 * @route POST /api/auth/reset-password/:token
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    
    // Hash token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    // Find user with token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return next(new ApiError(400, 'Invalid or expired reset token'));
    }
    
    // Update password
    user.passwordHash = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    
    // Clear all refresh tokens for security
    user.refreshTokens = [];
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.'
    });
  } catch (error) {
    logger.error(`Reset password error: ${error.message}`);
    next(error);
  }
};

/**
 * Refresh token
 * @route POST /api/auth/refresh-token
 */
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return next(new ApiError(400, 'Refresh token is required'));
    }
    
    // Find user with refresh token
    const user = await User.findOne({
      'refreshTokens.token': refreshToken,
      'refreshTokens.expires': { $gt: Date.now() }
    });
    
    if (!user) {
      return next(new ApiError(401, 'Invalid or expired refresh token'));
    }
    
    // Generate new access token
    const accessToken = generateToken(user);
    
    // Generate new refresh token
    const newRefreshToken = generateRefreshToken();
    const refreshTokenExpires = new Date(Date.now() + (parseInt(process.env.JWT_REFRESH_EXPIRATION) || 7 * 24 * 60 * 60 * 1000));
    
    // Remove old refresh token
    user.removeRefreshToken(refreshToken);
    
    // Add new refresh token
    user.addRefreshToken(
      newRefreshToken,
      refreshTokenExpires,
      req.headers['user-agent'] || 'unknown',
      req.ip
    );
    
    await user.save();
    
    // Send response
    res.status(200).json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    logger.error(`Refresh token error: ${error.message}`);
    next(error);
  }
};

/**
 * Logout
 * @route POST /api/auth/logout
 */
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return next(new ApiError(400, 'Refresh token is required'));
    }
    
    // Remove refresh token
    req.user.removeRefreshToken(refreshToken);
    await req.user.save();
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error(`Logout error: ${error.message}`);
    next(error);
  }
};

/**
 * Logout from all devices
 * @route POST /api/auth/logout-all
 */
exports.logoutAll = async (req, res, next) => {
  try {
    // Clear all refresh tokens
    req.user.refreshTokens = [];
    await req.user.save();
    
    res.status(200).json({
      success: true,
      message: 'Logged out from all devices successfully'
    });
  } catch (error) {
    logger.error(`Logout all error: ${error.message}`);
    next(error);
  }
};