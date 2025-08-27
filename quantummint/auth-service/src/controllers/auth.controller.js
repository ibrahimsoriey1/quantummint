const jwt = require('jsonwebtoken');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const crypto = require('crypto');
const User = require('../models/user.model');
const { redisClient } = require('../config/redis.config');
const { publishEvent } = require('../utils/event.util');
const logger = require('../utils/logger.util');
const { sendEmail } = require('../utils/email.util');

/**
 * Register a new user
 */
exports.register = async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      firstName,
      lastName,
      phoneNumber,
      countryCode,
      dateOfBirth
    } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email },
        { username },
        { phoneNumber }
      ]
    });
    
    if (existingUser) {
      let field = 'account';
      if (existingUser.email === email) field = 'email';
      if (existingUser.username === username) field = 'username';
      if (existingUser.phoneNumber === phoneNumber) field = 'phone number';
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_ACCOUNT',
          message: `An account with this ${field} already exists`
        }
      });
    }
    
    // Hash password
    const { hash, salt } = await User.hashPassword(password);
    
    // Create new user
    const user = new User({
      username,
      email,
      passwordHash: hash,
      salt,
      firstName,
      lastName,
      phoneNumber,
      countryCode,
      dateOfBirth: new Date(dateOfBirth),
      status: 'pending'
    });
    
    await user.save();
    
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    // Store token in Redis with 24-hour expiry
    await redisClient.set(
      `email_verification:${user._id.toString()}`,
      verificationToken,
      'EX',
      86400
    );
    
    // Send verification email
    await sendEmail({
      to: email,
      subject: 'Verify Your QuantumMint Account',
      template: 'email-verification',
      data: {
        firstName,
        verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}&userId=${user._id.toString()}`
      }
    });
    
    // Publish user created event
    await publishEvent('user.created', {
      userId: user._id.toString(),
      username,
      email,
      firstName,
      lastName
    });
    
    logger.info(`User registered: ${user._id} (${username})`);
    
    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
        verificationRequired: true
      }
    });
  } catch (error) {
    logger.error(`Registration error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during registration'
      }
    });
  }
};

/**
 * Verify email address
 */
exports.verifyEmail = async (req, res) => {
  try {
    const { userId, token } = req.body;
    
    // Check if user exists
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }
    
    if (user.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_VERIFIED',
          message: 'Email already verified'
        }
      });
    }
    
    // Get stored token
    const storedToken = await redisClient.get(`email_verification:${userId}`);
    
    if (!storedToken || storedToken !== token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired verification token'
        }
      });
    }
    
    // Update user status
    user.status = 'active';
    await user.save();
    
    // Delete token from Redis
    await redisClient.del(`email_verification:${userId}`);
    
    // Publish user verified event
    await publishEvent('user.verified', {
      userId: user._id.toString(),
      username: user.username,
      email: user.email
    });
    
    logger.info(`User email verified: ${userId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    logger.error(`Email verification error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during email verification'
      }
    });
  }
};

/**
 * Login user
 */
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user by username or email
    const user = await User.findOne({
      $or: [
        { username },
        { email: username }
      ]
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password'
        }
      });
    }
    
    // Check if account is locked
    if (user.accountLocked && user.accountLockedUntil > new Date()) {
      const remainingTime = Math.ceil((user.accountLockedUntil - new Date()) / 1000 / 60);
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: `Account is temporarily locked. Try again in ${remainingTime} minutes`
        }
      });
    }
    
    // Check if account is active
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: `Your account is ${user.status}. Please contact support`
        }
      });
    }
    
    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      // Increment failed login attempts
      user.failedLoginAttempts += 1;
      
      // Lock account after 5 failed attempts
      if (user.failedLoginAttempts >= 5) {
        user.accountLocked = true;
        user.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        
        await user.save();
        
        return res.status(401).json({
          success: false,
          error: {
            code: 'ACCOUNT_LOCKED',
            message: 'Too many failed login attempts. Account locked for 15 minutes'
          }
        });
      }
      
      await user.save();
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password'
        }
      });
    }
    
    // Reset failed login attempts
    user.failedLoginAttempts = 0;
    user.accountLocked = false;
    user.lastLogin = new Date();
    await user.save();
    
    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // Generate temporary token for 2FA
      const tempToken = jwt.sign(
        { userId: user._id.toString(), twoFactorPending: true },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );
      
      return res.status(200).json({
        success: true,
        message: 'Two-factor authentication required',
        data: {
          userId: user._id.toString(),
          twoFactorRequired: true,
          tempToken
        }
      });
    }
    
    // Generate tokens
    const accessToken = jwt.sign(
      {
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION }
    );
    
    const refreshToken = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRATION }
    );
    
    // Store refresh token in Redis
    await redisClient.set(
      `refresh_token:${user._id.toString()}`,
      refreshToken,
      'EX',
      7 * 24 * 60 * 60 // 7 days
    );
    
    // Publish login event
    await publishEvent('user.login', {
      userId: user._id.toString(),
      username: user.username,
      timestamp: new Date().toISOString()
    });
    
    logger.info(`User logged in: ${user._id} (${user.username})`);
    
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        expiresIn: parseInt(process.env.JWT_EXPIRATION),
        user: {
          userId: user._id.toString(),
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          twoFactorEnabled: user.twoFactorEnabled
        }
      }
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during login'
      }
    });
  }
};

/**
 * Verify two-factor authentication
 */
exports.verifyTwoFactor = async (req, res) => {
  try {
    const { userId, code, tempToken } = req.body;
    
    // Verify temp token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
      
      if (!decoded.twoFactorPending || decoded.userId !== userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid temporary token'
          }
        });
      }
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired temporary token'
        }
      });
    }
    
    // Find user
    const user = await User.findById(userId);
    
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Two-factor authentication is not enabled for this user'
        }
      });
    }
    
    // Verify code
    const isValid = authenticator.verify({
      token: code,
      secret: user.twoFactorSecret
    });
    
    // Check recovery code if TOTP fails
    let usedRecoveryCode = false;
    if (!isValid && user.recoveryCodes && user.recoveryCodes.length > 0) {
      const recoveryCodeIndex = user.recoveryCodes.indexOf(code);
      
      if (recoveryCodeIndex !== -1) {
        // Remove used recovery code
        user.recoveryCodes.splice(recoveryCodeIndex, 1);
        await user.save();
        
        usedRecoveryCode = true;
      } else {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CODE',
            message: 'Invalid authentication code'
          }
        });
      }
    } else if (!isValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CODE',
          message: 'Invalid authentication code'
        }
      });
    }
    
    // Generate tokens
    const accessToken = jwt.sign(
      {
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION }
    );
    
    const refreshToken = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRATION }
    );
    
    // Store refresh token in Redis
    await redisClient.set(
      `refresh_token:${user._id.toString()}`,
      refreshToken,
      'EX',
      7 * 24 * 60 * 60 // 7 days
    );
    
    logger.info(`User completed 2FA: ${user._id} (${user.username})`);
    
    return res.status(200).json({
      success: true,
      message: 'Two-factor authentication successful',
      data: {
        accessToken,
        refreshToken,
        expiresIn: parseInt(process.env.JWT_EXPIRATION),
        recoveryCodesRemaining: user.recoveryCodes ? user.recoveryCodes.length : 0,
        usedRecoveryCode
      }
    });
  } catch (error) {
    logger.error(`2FA verification error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during two-factor authentication'
      }
    });
  }
};

/**
 * Refresh access token
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Refresh token is required'
        }
      });
    }
    
    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired refresh token'
        }
      });
    }
    
    const { userId } = decoded;
    
    // Check if token exists in Redis
    const storedToken = await redisClient.get(`refresh_token:${userId}`);
    
    if (!storedToken || storedToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired refresh token'
        }
      });
    }
    
    // Get user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }
    
    // Generate new tokens
    const newAccessToken = jwt.sign(
      {
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION }
    );
    
    const newRefreshToken = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRATION }
    );
    
    // Update refresh token in Redis
    await redisClient.set(
      `refresh_token:${userId}`,
      newRefreshToken,
      'EX',
      7 * 24 * 60 * 60 // 7 days
    );
    
    logger.info(`Token refreshed for user: ${userId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: parseInt(process.env.JWT_EXPIRATION)
      }
    });
  } catch (error) {
    logger.error(`Token refresh error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during token refresh'
      }
    });
  }
};

/**
 * Logout user
 */
exports.logout = async (req, res) => {
  try {
    const { userId } = req.user;
    const authHeader = req.headers.authorization;
    const token = authHeader.split(' ')[1];
    
    // Get token expiration
    const decoded = jwt.decode(token);
    const exp = decoded.exp;
    const now = Math.floor(Date.now() / 1000);
    const ttl = exp - now;
    
    if (ttl > 0) {
      // Add token to blacklist
      await redisClient.set(`bl_${token}`, 'true', 'EX', ttl);
    }
    
    // Remove refresh token
    await redisClient.del(`refresh_token:${userId}`);
    
    // Publish logout event
    await publishEvent('user.logout', {
      userId,
      timestamp: new Date().toISOString()
    });
    
    logger.info(`User logged out: ${userId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error(`Logout error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during logout'
      }
    });
  }
};

/**
 * Request password reset
 */
exports.resetPasswordRequest = async (req, res) => {
  try {
    const { email } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    
    // Don't reveal if user exists or not
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'Password reset instructions sent to your email'
      });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Store token in Redis with 1-hour expiry
    await redisClient.set(
      `password_reset:${user._id.toString()}`,
      resetToken,
      'EX',
      3600
    );
    
    // Send reset email
    await sendEmail({
      to: email,
      subject: 'Reset Your QuantumMint Password',
      template: 'password-reset',
      data: {
        firstName: user.firstName,
        resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&userId=${user._id.toString()}`
      }
    });
    
    logger.info(`Password reset requested for user: ${user._id}`);
    
    return res.status(200).json({
      success: true,
      message: 'Password reset instructions sent to your email'
    });
  } catch (error) {
    logger.error(`Password reset request error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during password reset request'
      }
    });
  }
};

/**
 * Reset password
 */
exports.resetPassword = async (req, res) => {
  try {
    const { userId, token, newPassword } = req.body;
    
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }
    
    // Get stored token
    const storedToken = await redisClient.get(`password_reset:${userId}`);
    
    if (!storedToken || storedToken !== token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired reset token'
        }
      });
    }
    
    // Hash new password
    const { hash, salt } = await User.hashPassword(newPassword);
    
    // Update user password
    user.passwordHash = hash;
    user.salt = salt;
    await user.save();
    
    // Delete token from Redis
    await redisClient.del(`password_reset:${userId}`);
    
    // Invalidate all existing sessions
    const userTokens = await redisClient.keys(`refresh_token:${userId}`);
    if (userTokens.length > 0) {
      await redisClient.del(userTokens);
    }
    
    // Send confirmation email
    await sendEmail({
      to: user.email,
      subject: 'Your QuantumMint Password Has Been Reset',
      template: 'password-reset-confirmation',
      data: {
        firstName: user.firstName
      }
    });
    
    logger.info(`Password reset completed for user: ${userId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    logger.error(`Password reset error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during password reset'
      }
    });
  }
};