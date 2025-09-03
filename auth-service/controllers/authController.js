const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { sendEmail } = require('../utils/email');
const { getClient: getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');
const { sanitize } = require('../../shared/utils/validation');

// Generate JWT token
const generateToken = (userId, expiresIn = process.env.JWT_EXPIRES_IN || '24h') => {
  return jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

// Generate refresh token
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

// Store token in Redis blacklist
const blacklistToken = async (token, expiresIn) => {
  try {
    const redis = getRedisClient();
    const ttl = Math.floor(expiresIn / 1000);
    await redis.setEx(`blacklist:${token}`, ttl, '1');
    logger.cache('Token blacklisted', { token: token.substring(0, 10) + '...' });
  } catch (error) {
    logger.error('Failed to blacklist token:', error);
  }
};

// Check if token is blacklisted
const isTokenBlacklisted = async (token) => {
  try {
    const redis = getRedisClient();
    const result = await redis.get(`blacklist:${token}`);
    return result === '1';
  } catch (error) {
    logger.error('Failed to check token blacklist:', error);
    return false;
  }
};

// @desc    Register a new user
// @route   POST /api/v1/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, phone, dateOfBirth } = req.body;

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

    // Create verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = new User({
      username: sanitize.string(username),
      email: sanitize.email(email),
      password,
      firstName: sanitize.string(firstName),
      lastName: sanitize.string(lastName),
      phone: phone ? sanitize.phone(phone) : undefined,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        registrationSource: 'web'
      }
    });

    await user.save();

    // Send verification email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Verify Your Email - QuantumMint',
        template: 'emailVerification',
        data: {
          name: user.firstName,
          verificationToken,
          verificationExpires: verificationExpires.toISOString()
        }
      });
      logger.email('Verification email sent', { userId: user._id, email: user.email });
    } catch (emailError) {
      logger.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails
    }

    // Generate tokens
    const accessToken = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Store refresh token in Redis
    try {
      const redis = getRedisClient();
      await redis.setEx(`refresh:${user._id}`, 7 * 24 * 60 * 60, refreshToken); // 7 days
    } catch (redisError) {
      logger.error('Failed to store refresh token:', redisError);
    }

    logger.auth('User registered successfully', { userId: user._id, email: user.email });

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email to verify your account.',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isVerified: user.isVerified,
          twoFactorEnabled: user.twoFactorEnabled
        },
        tokens: {
          accessToken,
          refreshToken
        }
      }
    });

  } catch (error) {
    logger.error('Registration failed:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/v1/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is locked
    if (user.isLocked()) {
      return res.status(423).json({
        success: false,
        message: 'Account is locked due to too many failed login attempts. Please try again later.'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Increment login attempts
      await user.incLoginAttempts();
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const accessToken = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Store refresh token in Redis
    try {
      const redis = getRedisClient();
      await redis.setEx(`refresh:${user._id}`, 7 * 24 * 60 * 60, refreshToken); // 7 days
    } catch (redisError) {
      logger.error('Failed to store refresh token:', redisError);
    }

    logger.auth('User logged in successfully', { userId: user._id, email: user.email });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isVerified: user.isVerified,
          twoFactorEnabled: user.twoFactorEnabled,
          role: user.role
        },
        tokens: {
          accessToken,
          refreshToken
        }
      }
    });

  } catch (error) {
    logger.error('Login failed:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
};

// @desc    Logout user (invalidate token)
// @route   POST /api/v1/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      // Decode token to get expiration
      const decoded = jwt.decode(token);
      const expiresIn = decoded.exp * 1000 - Date.now();
      
      // Blacklist the token
      await blacklistToken(token, expiresIn);
    }

    // Remove refresh token from Redis
    try {
      const redis = getRedisClient();
      await redis.del(`refresh:${req.user.userId}`);
    } catch (redisError) {
      logger.error('Failed to remove refresh token:', redisError);
    }

    logger.auth('User logged out', { userId: req.user.userId });

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    logger.error('Logout failed:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed. Please try again.'
    });
  }
};

// @desc    Refresh access token
// @route   POST /api/v1/auth/refresh
// @access  Public
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    // Check if refresh token exists in Redis
    try {
      const redis = getRedisClient();
      const storedToken = await redis.get(`refresh:${decoded.userId}`);
      
      if (!storedToken || storedToken !== token) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }
    } catch (redisError) {
      logger.error('Failed to verify refresh token:', redisError);
      return res.status(500).json({
        success: false,
        message: 'Token verification failed'
      });
    }

    // Generate new access token
    const newAccessToken = generateToken(decoded.userId);

    logger.auth('Token refreshed', { userId: decoded.userId });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken
      }
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token expired'
      });
    }

    logger.error('Token refresh failed:', error);
    res.status(500).json({
      success: false,
      message: 'Token refresh failed. Please try again.'
    });
  }
};

// @desc    Change user password
// @route   POST /api/v1/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    // Find user
    const user = await User.findById(userId).select('+password');
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

    // Invalidate all existing tokens
    try {
      const redis = getRedisClient();
      await redis.del(`refresh:${userId}`);
    } catch (redisError) {
      logger.error('Failed to invalidate refresh tokens:', redisError);
    }

    logger.auth('Password changed successfully', { userId });

    res.json({
      success: true,
      message: 'Password changed successfully. Please login again with your new password.'
    });

  } catch (error) {
    logger.error('Password change failed:', error);
    res.status(500).json({
      success: false,
      message: 'Password change failed. Please try again.'
    });
  }
};

// @desc    Send password reset email
// @route   POST /api/v1/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    // Store reset token in Redis
    try {
      const redis = getRedisClient();
      await redis.setEx(`reset:${resetToken}`, 3600, user._id.toString()); // 1 hour
    } catch (redisError) {
      logger.error('Failed to store reset token:', redisError);
      return res.status(500).json({
        success: false,
        message: 'Failed to process password reset request'
      });
    }

    // Send reset email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset Request - QuantumMint',
        template: 'passwordReset',
        data: {
          name: user.firstName,
          resetToken,
          resetExpires: resetExpires.toISOString()
        }
      });
      logger.email('Password reset email sent', { userId: user._id, email: user.email });
    } catch (emailError) {
      logger.error('Failed to send password reset email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send password reset email'
      });
    }

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });

  } catch (error) {
    logger.error('Forgot password failed:', error);
    res.status(500).json({
      success: false,
      message: 'Password reset request failed. Please try again.'
    });
  }
};

// @desc    Reset password with token
// @route   POST /api/v1/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Get user ID from Redis
    let userId;
    try {
      const redis = getRedisClient();
      userId = await redis.get(`reset:${token}`);
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }
    } catch (redisError) {
      logger.error('Failed to retrieve reset token:', redisError);
      return res.status(500).json({
        success: false,
        message: 'Token verification failed'
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Remove reset token from Redis
    try {
      const redis = getRedisClient();
      await redis.del(`reset:${token}`);
    } catch (redisError) {
      logger.error('Failed to remove reset token:', redisError);
    }

    // Invalidate all existing tokens
    try {
      const redis = getRedisClient();
      await redis.del(`refresh:${userId}`);
    } catch (redisError) {
      logger.error('Failed to invalidate refresh tokens:', redisError);
    }

    logger.auth('Password reset successfully', { userId });

    res.json({
      success: true,
      message: 'Password reset successfully. Please login with your new password.'
    });

  } catch (error) {
    logger.error('Password reset failed:', error);
    res.status(500).json({
      success: false,
      message: 'Password reset failed. Please try again.'
    });
  }
};

// @desc    Verify user email with token
// @route   POST /api/v1/auth/verify-email
// @access  Public
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    // Find user by verification token
    const user = await User.findOne({
      'metadata.verificationToken': token,
      'metadata.verificationExpires': { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    // Mark user as verified
    user.isVerified = true;
    user.metadata.verificationToken = undefined;
    user.metadata.verificationExpires = undefined;
    await user.save();

    logger.auth('Email verified successfully', { userId: user._id, email: user.email });

    res.json({
      success: true,
      message: 'Email verified successfully. You can now use all features of the platform.'
    });

  } catch (error) {
    logger.error('Email verification failed:', error);
    res.status(500).json({
      success: false,
      message: 'Email verification failed. Please try again.'
    });
  }
};

// @desc    Resend email verification
// @route   POST /api/v1/auth/resend-verification
// @access  Public
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with new token
    user.metadata.verificationToken = verificationToken;
    user.metadata.verificationExpires = verificationExpires;
    await user.save();

    // Send verification email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Verify Your Email - QuantumMint',
        template: 'emailVerification',
        data: {
          name: user.firstName,
          verificationToken,
          verificationExpires: verificationExpires.toISOString()
        }
      });
      logger.email('Verification email resent', { userId: user._id, email: user.email });
    } catch (emailError) {
      logger.error('Failed to send verification email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email'
      });
    }

    res.json({
      success: true,
      message: 'Verification email sent successfully. Please check your inbox.'
    });

  } catch (error) {
    logger.error('Resend verification failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend verification email. Please try again.'
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/v1/auth/me
// @access  Private
const getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId).select('-password');
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
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          dateOfBirth: user.dateOfBirth,
          isVerified: user.isVerified,
          twoFactorEnabled: user.twoFactorEnabled,
          role: user.role,
          profilePicture: user.profilePicture,
          preferences: user.preferences,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin
        }
      }
    });

  } catch (error) {
    logger.error('Get profile failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile. Please try again.'
    });
  }
};

// @desc    Validate JWT token
// @route   POST /api/v1/auth/validate-token
// @access  Public
const validateToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    // Check if token is blacklisted
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        message: 'Token is invalid'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    // Check if user exists
    const user = await User.findById(decoded.userId).select('_id username email isActive');
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          isActive: user.isActive
        }
      }
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    logger.error('Token validation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Token validation failed'
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  refreshToken,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  getProfile,
  validateToken
};
