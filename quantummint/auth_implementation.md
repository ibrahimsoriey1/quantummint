# User Authentication System Implementation

This document outlines the implementation of the user authentication system for the Digital Money Generation System.

## Overview

The authentication system provides secure user registration, login, two-factor authentication, and session management. It is built as a separate microservice that communicates with other services through secure API calls.

## Key Components

1. User registration and verification
2. Login and session management
3. Two-factor authentication
4. Password management
5. Role-based access control
6. JWT token handling

## Implementation Details

### 1. User Model

```javascript
// auth-service/src/models/user.model.js

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true
  },
  countryCode: {
    type: String,
    required: true
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: String
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'compliance_officer'],
    default: 'user'
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'banned'],
    default: 'pending'
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: String,
  verificationToken: String,
  verificationTokenExpiry: Date,
  passwordResetToken: String,
  passwordResetExpiry: Date,
  lastLogin: Date,
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  accountLocked: {
    type: Boolean,
    default: false
  },
  accountLockedUntil: Date,
  refreshTokens: [{
    token: String,
    expiresAt: Date,
    device: String,
    ipAddress: String,
    lastUsed: Date
  }]
}, {
  timestamps: true
});

// Pre-save hook to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Method to handle failed login attempts
userSchema.methods.registerLoginAttempt = async function(success) {
  if (success) {
    this.failedLoginAttempts = 0;
    this.accountLocked = false;
    this.accountLockedUntil = null;
    this.lastLogin = new Date();
  } else {
    this.failedLoginAttempts += 1;
    
    // Lock account after 5 failed attempts
    if (this.failedLoginAttempts >= 5) {
      this.accountLocked = true;
      // Lock for 30 minutes
      this.accountLockedUntil = new Date(Date.now() + 30 * 60 * 1000);
    }
  }
  
  await this.save();
};

// Method to add refresh token
userSchema.methods.addRefreshToken = function(token, expiresAt, device, ipAddress) {
  this.refreshTokens.push({
    token,
    expiresAt,
    device,
    ipAddress,
    lastUsed: new Date()
  });
  
  // Limit to 5 active refresh tokens per user
  if (this.refreshTokens.length > 5) {
    this.refreshTokens.sort((a, b) => a.lastUsed - b.lastUsed);
    this.refreshTokens.shift();
  }
};

// Method to remove refresh token
userSchema.methods.removeRefreshToken = function(token) {
  this.refreshTokens = this.refreshTokens.filter(t => t.token !== token);
};

// Method to clean expired refresh tokens
userSchema.methods.cleanExpiredRefreshTokens = function() {
  const now = new Date();
  this.refreshTokens = this.refreshTokens.filter(t => t.expiresAt > now);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
```

### 2. Authentication Controller

```javascript
// auth-service/src/controllers/auth.controller.js

const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { sendEmail } = require('../utils/email.util');
const { redisClient } = require('../config/redis.config');
const { validateRegistration, validateLogin } = require('../validation/auth.validation');
const logger = require('../utils/logger.util');

// Environment variables
const {
  JWT_SECRET,
  JWT_ACCESS_EXPIRATION,
  JWT_REFRESH_EXPIRATION,
  TOTP_ISSUER
} = process.env;

// Helper function to generate tokens
const generateTokens = (userId, role) => {
  const accessToken = jwt.sign(
    { userId, role },
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRATION }
  );
  
  const refreshToken = jwt.sign(
    { userId, type: 'refresh', tokenId: uuidv4() },
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRATION }
  );
  
  return { accessToken, refreshToken };
};

// Register a new user
exports.register = async (req, res) => {
  try {
    // Validate request body
    const { error } = validateRegistration(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid registration data',
          details: error.details.map(d => ({ field: d.path[0], message: d.message }))
        }
      });
    }
    
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
      $or: [{ email }, { username }, { phoneNumber }]
    });
    
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'User already exists',
          details: existingUser.email === email ? 'Email already in use' :
                  existingUser.username === username ? 'Username already taken' :
                  'Phone number already in use'
        }
      });
    }
    
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Create new user
    const newUser = new User({
      username,
      email,
      passwordHash: password, // Will be hashed by pre-save hook
      firstName,
      lastName,
      phoneNumber,
      countryCode,
      dateOfBirth,
      verificationToken,
      verificationTokenExpiry
    });
    
    await newUser.save();
    
    // Send verification email
    const verificationUrl = `${req.protocol}://${req.get('host')}/api/auth/verify-email/${verificationToken}`;
    
    await sendEmail({
      to: email,
      subject: 'Verify Your Email Address',
      text: `Please verify your email address by clicking on the link: ${verificationUrl}`,
      html: `
        <h1>Welcome to Digital Money System!</h1>
        <p>Please verify your email address by clicking on the link below:</p>
        <a href="${verificationUrl}">Verify Email</a>
        <p>This link will expire in 24 hours.</p>
      `
    });
    
    logger.info(`New user registered: ${username} (${email})`);
    
    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        userId: newUser._id,
        username: newUser.username,
        email: newUser.email,
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

// Verify email
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpiry: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid or expired verification token'
        }
      });
    }
    
    // Update user
    user.emailVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    
    // If both email and phone are verified, set status to active
    if (user.phoneVerified) {
      user.status = 'active';
    }
    
    await user.save();
    
    logger.info(`Email verified for user: ${user.username} (${user.email})`);
    
    return res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      data: {
        userId: user._id,
        status: user.status
      }
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

// Login
exports.login = async (req, res) => {
  try {
    // Validate request body
    const { error } = validateLogin(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid login data',
          details: error.details.map(d => ({ field: d.path[0], message: d.message }))
        }
      });
    }
    
    const { username, password } = req.body;
    
    // Find user by username or email
    const user = await User.findOne({
      $or: [
        { username },
        { email: username.includes('@') ? username : null }
      ]
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid username or password'
        }
      });
    }
    
    // Check if account is locked
    if (user.accountLocked && user.accountLockedUntil > Date.now()) {
      const remainingTime = Math.ceil((user.accountLockedUntil - Date.now()) / 60000);
      
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Account is temporarily locked. Try again in ${remainingTime} minutes`
        }
      });
    }
    
    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      await user.registerLoginAttempt(false);
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid username or password'
        }
      });
    }
    
    // Check if email is verified
    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Email not verified. Please verify your email before logging in'
        }
      });
    }
    
    // Check if account is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Account is ${user.status}. Please contact support for assistance`
        }
      });
    }
    
    // Register successful login attempt
    await user.registerLoginAttempt(true);
    
    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // Generate temporary token for 2FA verification
      const tempToken = jwt.sign(
        { userId: user._id, type: '2fa_temp' },
        JWT_SECRET,
        { expiresIn: '5m' }
      );
      
      return res.status(200).json({
        success: true,
        message: 'Two-factor authentication required',
        data: {
          userId: user._id,
          twoFactorRequired: true,
          tempToken
        }
      });
    }
    
    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id, user.role);
    
    // Store refresh token
    const refreshTokenExpiry = new Date(Date.now() + parseInt(JWT_REFRESH_EXPIRATION) * 1000);
    user.addRefreshToken(
      refreshToken,
      refreshTokenExpiry,
      req.headers['user-agent'] || 'unknown',
      req.ip
    );
    
    await user.save();
    
    // Store access token in Redis for blacklisting if needed
    await redisClient.set(
      `access_token:${user._id}:${Date.now()}`,
      accessToken,
      'EX',
      parseInt(JWT_ACCESS_EXPIRATION)
    );
    
    logger.info(`User logged in: ${user.username} (${user.email})`);
    
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        expiresIn: parseInt(JWT_ACCESS_EXPIRATION),
        user: {
          userId: user._id,
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

// Verify 2FA
exports.verify2FA = async (req, res) => {
  try {
    const { userId, code, tempToken } = req.body;
    
    if (!userId || !code || !tempToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Missing required fields'
        }
      });
    }
    
    // Verify temp token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token'
        }
      });
    }
    
    if (decoded.type !== '2fa_temp' || decoded.userId !== userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token'
        }
      });
    }
    
    // Find user
    const user = await User.findById(userId);
    
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid request'
        }
      });
    }
    
    // Verify TOTP code
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1 // Allow 1 time step before/after for clock drift
    });
    
    if (!verified) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid verification code'
        }
      });
    }
    
    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id, user.role);
    
    // Store refresh token
    const refreshTokenExpiry = new Date(Date.now() + parseInt(JWT_REFRESH_EXPIRATION) * 1000);
    user.addRefreshToken(
      refreshToken,
      refreshTokenExpiry,
      req.headers['user-agent'] || 'unknown',
      req.ip
    );
    
    await user.save();
    
    // Store access token in Redis for blacklisting if needed
    await redisClient.set(
      `access_token:${user._id}:${Date.now()}`,
      accessToken,
      'EX',
      parseInt(JWT_ACCESS_EXPIRATION)
    );
    
    logger.info(`2FA verification successful for user: ${user.username}`);
    
    return res.status(200).json({
      success: true,
      message: 'Two-factor authentication successful',
      data: {
        accessToken,
        refreshToken,
        expiresIn: parseInt(JWT_ACCESS_EXPIRATION),
        user: {
          userId: user._id,
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

// Refresh token
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Refresh token is required'
        }
      });
    }
    
    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired refresh token'
        }
      });
    }
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token type'
        }
      });
    }
    
    // Find user and check if refresh token exists
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found'
        }
      });
    }
    
    // Clean expired refresh tokens
    user.cleanExpiredRefreshTokens();
    
    // Check if refresh token exists in user's refresh tokens
    const tokenExists = user.refreshTokens.some(t => t.token === refreshToken);
    
    if (!tokenExists) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Refresh token has been revoked'
        }
      });
    }
    
    // Remove the used refresh token
    user.removeRefreshToken(refreshToken);
    
    // Generate new tokens
    const newTokens = generateTokens(user._id, user.role);
    
    // Store new refresh token
    const refreshTokenExpiry = new Date(Date.now() + parseInt(JWT_REFRESH_EXPIRATION) * 1000);
    user.addRefreshToken(
      newTokens.refreshToken,
      refreshTokenExpiry,
      req.headers['user-agent'] || 'unknown',
      req.ip
    );
    
    await user.save();
    
    // Store access token in Redis for blacklisting if needed
    await redisClient.set(
      `access_token:${user._id}:${Date.now()}`,
      newTokens.accessToken,
      'EX',
      parseInt(JWT_ACCESS_EXPIRATION)
    );
    
    logger.info(`Token refreshed for user: ${user.username}`);
    
    return res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresIn: parseInt(JWT_ACCESS_EXPIRATION)
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

// Logout
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Access token is required'
        }
      });
    }
    
    const accessToken = authHeader.split(' ')[1];
    
    // Verify access token
    let decoded;
    try {
      decoded = jwt.verify(accessToken, JWT_SECRET);
    } catch (err) {
      // Even if token is invalid, we'll continue with the logout process
      logger.warn(`Logout with invalid access token: ${err.message}`);
    }
    
    if (decoded && decoded.userId) {
      // Blacklist the access token
      const remainingTtl = decoded.exp - Math.floor(Date.now() / 1000);
      if (remainingTtl > 0) {
        await redisClient.set(
          `blacklist:${accessToken}`,
          'true',
          'EX',
          remainingTtl
        );
      }
      
      // If refresh token is provided, remove it from the user
      if (refreshToken) {
        const user = await User.findById(decoded.userId);
        if (user) {
          user.removeRefreshToken(refreshToken);
          await user.save();
        }
      }
      
      logger.info(`User logged out: ${decoded.userId}`);
    }
    
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

// Setup 2FA
exports.setup2FA = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found'
        }
      });
    }
    
    // Generate new TOTP secret
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `${TOTP_ISSUER}:${user.email}`
    });
    
    // Store secret temporarily (will be confirmed after verification)
    await redisClient.set(
      `2fa_setup:${userId}`,
      secret.base32,
      'EX',
      600 // 10 minutes expiry
    );
    
    // Generate QR code
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);
    
    logger.info(`2FA setup initiated for user: ${user.username}`);
    
    return res.status(200).json({
      success: true,
      message: 'Two-factor authentication setup initiated',
      data: {
        secret: secret.base32,
        qrCodeUrl
      }
    });
  } catch (error) {
    logger.error(`2FA setup error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during two-factor authentication setup'
      }
    });
  }
};

// Verify and enable 2FA
exports.verify2FASetup = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Verification code is required'
        }
      });
    }
    
    // Get temporary secret from Redis
    const secret = await redisClient.get(`2fa_setup:${userId}`);
    
    if (!secret) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Two-factor authentication setup has expired. Please start again'
        }
      });
    }
    
    // Verify TOTP code
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: 1
    });
    
    if (!verified) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid verification code'
        }
      });
    }
    
    // Update user with 2FA enabled
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found'
        }
      });
    }
    
    user.twoFactorEnabled = true;
    user.twoFactorSecret = secret;
    
    await user.save();
    
    // Delete temporary secret from Redis
    await redisClient.del(`2fa_setup:${userId}`);
    
    // Generate recovery codes
    const recoveryCodes = Array(10)
      .fill(0)
      .map(() => crypto.randomBytes(10).toString('hex'));
    
    // Store recovery codes (hashed)
    const hashedCodes = await Promise.all(
      recoveryCodes.map(async code => {
        const salt = await bcrypt.genSalt(10);
        return bcrypt.hash(code, salt);
      })
    );
    
    await redisClient.set(
      `recovery_codes:${userId}`,
      JSON.stringify(hashedCodes),
      'EX',
      60 * 60 * 24 * 365 // 1 year expiry
    );
    
    logger.info(`2FA enabled for user: ${user.username}`);
    
    return res.status(200).json({
      success: true,
      message: 'Two-factor authentication enabled successfully',
      data: {
        recoveryCodes
      }
    });
  } catch (error) {
    logger.error(`2FA verification error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during two-factor authentication verification'
      }
    });
  }
};

// Disable 2FA
exports.disable2FA = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Password is required'
        }
      });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found'
        }
      });
    }
    
    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid password'
        }
      });
    }
    
    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    
    await user.save();
    
    // Delete recovery codes
    await redisClient.del(`recovery_codes:${userId}`);
    
    logger.info(`2FA disabled for user: ${user.username}`);
    
    return res.status(200).json({
      success: true,
      message: 'Two-factor authentication disabled successfully'
    });
  } catch (error) {
    logger.error(`2FA disable error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while disabling two-factor authentication'
      }
    });
  }
};

// Request password reset
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Email is required'
        }
      });
    }
    
    const user = await User.findOne({ email });
    
    // Don't reveal if user exists or not
    if (!user) {
      logger.info(`Password reset requested for non-existent email: ${email}`);
      return res.status(200).json({
        success: true,
        message: 'Password reset instructions sent to your email if it exists in our system'
      });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    // Update user
    user.passwordResetToken = resetToken;
    user.passwordResetExpiry = resetTokenExpiry;
    
    await user.save();
    
    // Send reset email
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}`;
    
    await sendEmail({
      to: email,
      subject: 'Password Reset Request',
      text: `You requested a password reset. Please click on the link to reset your password: ${resetUrl}. This link will expire in 1 hour.`,
      html: `
        <h1>Password Reset Request</h1>
        <p>You requested a password reset. Please click on the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
      `
    });
    
    logger.info(`Password reset requested for user: ${user.username}`);
    
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

// Reset password
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Token and new password are required'
        }
      });
    }
    
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpiry: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid or expired reset token'
        }
      });
    }
    
    // Update password
    user.passwordHash = newPassword; // Will be hashed by pre-save hook
    user.passwordResetToken = undefined;
    user.passwordResetExpiry = undefined;
    
    // Invalidate all refresh tokens
    user.refreshTokens = [];
    
    await user.save();
    
    logger.info(`Password reset successful for user: ${user.username}`);
    
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
```

### 3. Authentication Routes

```javascript
// auth-service/src/routes/auth.routes.js

const express = require('express');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');
const router = express.Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify-2fa', authController.verify2FA);
router.post('/refresh-token', authController.refreshToken);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/reset-password-request', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);

// Protected routes
router.post('/logout', authMiddleware.verifyToken, authController.logout);
router.post('/enable-2fa', authMiddleware.verifyToken, authController.setup2FA);
router.post('/verify-2fa-setup', authMiddleware.verifyToken, authController.verify2FASetup);
router.post('/disable-2fa', authMiddleware.verifyToken, authController.disable2FA);

module.exports = router;
```

### 4. Authentication Middleware

```javascript
// auth-service/src/middleware/auth.middleware.js

const jwt = require('jsonwebtoken');
const { redisClient } = require('../config/redis.config');
const logger = require('../utils/logger.util');

// Environment variables
const { JWT_SECRET } = process.env;

// Verify JWT token
exports.verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Check if token is blacklisted
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token has been revoked'
        }
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check token type
    if (decoded.type && decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token type'
        }
      });
    }
    
    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      role: decoded.role
    };
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token has expired'
        }
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token'
        }
      });
    }
    
    logger.error(`Authentication middleware error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during authentication'
      }
    });
  }
};

// Check user role
exports.checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource'
        }
      });
    }
    
    next();
  };
};

// Rate limiting middleware
exports.rateLimiter = (limit, windowMs) => {
  return async (req, res, next) => {
    try {
      const ip = req.ip;
      const key = `rate_limit:${ip}:${req.originalUrl}`;
      
      // Get current count
      const current = await redisClient.get(key);
      
      if (current && parseInt(current) >= limit) {
        return res.status(429).json({
          success: false,
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Rate limit exceeded',
            retryAfter: Math.ceil(windowMs / 1000)
          }
        });
      }
      
      // Increment count
      if (current) {
        await redisClient.incr(key);
      } else {
        await redisClient.set(key, 1, 'EX', Math.ceil(windowMs / 1000));
      }
      
      next();
    } catch (error) {
      logger.error(`Rate limiter error: ${error.message}`);
      next(); // Continue even if rate limiter fails
    }
  };
};
```

### 5. Redis Configuration

```javascript
// auth-service/src/config/redis.config.js

const redis = require('redis');
const logger = require('../utils/logger.util');

// Environment variables
const {
  REDIS_HOST = 'localhost',
  REDIS_PORT = 6379,
  REDIS_PASSWORD
} = process.env;

// Create Redis client
const redisClient = redis.createClient({
  url: `redis://${REDIS_HOST}:${REDIS_PORT}`,
  password: REDIS_PASSWORD
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
    logger.info('Connected to Redis');
  } catch (error) {
    logger.error(`Redis connection error: ${error.message}`);
    process.exit(1);
  }
})();

// Handle Redis errors
redisClient.on('error', (error) => {
  logger.error(`Redis error: ${error.message}`);
});

module.exports = { redisClient };
```

### 6. Email Utility

```javascript
// auth-service/src/utils/email.util.js

const nodemailer = require('nodemailer');
const logger = require('./logger.util');

// Environment variables
const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM = 'noreply@digitalmoneysystem.com'
} = process.env;

// Create transporter
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === '465',
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  }
});

// Send email
exports.sendEmail = async (options) => {
  try {
    const mailOptions = {
      from: `Digital Money System <${EMAIL_FROM}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html
    };
    
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent: ${info.messageId}`);
    
    return info;
  } catch (error) {
    logger.error(`Email sending error: ${error.message}`);
    throw error;
  }
};

// Verify transporter connection
exports.verifyConnection = async () => {
  try {
    await transporter.verify();
    logger.info('Email service is ready');
    return true;
  } catch (error) {
    logger.error(`Email service error: ${error.message}`);
    return false;
  }
};
```

### 7. Logger Utility

```javascript
// auth-service/src/utils/logger.util.js

const winston = require('winston');
const path = require('path');

// Environment variables
const { NODE_ENV = 'development' } = process.env;

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create logger
const logger = winston.createLogger({
  level: NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'auth-service' },
  transports: [
    // Write logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          info => `${info.timestamp} ${info.level}: ${info.message}`
        )
      )
    }),
    // Write logs to file
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join('logs', 'combined.log')
    })
  ]
});

module.exports = logger;
```

### 8. Validation Utility

```javascript
// auth-service/src/validation/auth.validation.js

const Joi = require('joi');

// Validate user registration
exports.validateRegistration = (data) => {
  const schema = Joi.object({
    username: Joi.string()
      .alphanum()
      .min(3)
      .max(30)
      .required()
      .messages({
        'string.base': 'Username must be a string',
        'string.alphanum': 'Username must only contain alphanumeric characters',
        'string.min': 'Username must be at least {#limit} characters long',
        'string.max': 'Username cannot be more than {#limit} characters long',
        'any.required': 'Username is required'
      }),
    
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.base': 'Email must be a string',
        'string.email': 'Email must be a valid email address',
        'any.required': 'Email is required'
      }),
    
    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.base': 'Password must be a string',
        'string.min': 'Password must be at least {#limit} characters long',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'Password is required'
      }),
    
    firstName: Joi.string()
      .required()
      .messages({
        'string.base': 'First name must be a string',
        'any.required': 'First name is required'
      }),
    
    lastName: Joi.string()
      .required()
      .messages({
        'string.base': 'Last name must be a string',
        'any.required': 'Last name is required'
      }),
    
    phoneNumber: Joi.string()
      .required()
      .messages({
        'string.base': 'Phone number must be a string',
        'any.required': 'Phone number is required'
      }),
    
    countryCode: Joi.string()
      .required()
      .messages({
        'string.base': 'Country code must be a string',
        'any.required': 'Country code is required'
      }),
    
    dateOfBirth: Joi.date()
      .max('now')
      .required()
      .messages({
        'date.base': 'Date of birth must be a valid date',
        'date.max': 'Date of birth cannot be in the future',
        'any.required': 'Date of birth is required'
      })
  });
  
  return schema.validate(data);
};

// Validate user login
exports.validateLogin = (data) => {
  const schema = Joi.object({
    username: Joi.string()
      .required()
      .messages({
        'string.base': 'Username must be a string',
        'any.required': 'Username or email is required'
      }),
    
    password: Joi.string()
      .required()
      .messages({
        'string.base': 'Password must be a string',
        'any.required': 'Password is required'
      })
  });
  
  return schema.validate(data);
};

// Validate password reset request
exports.validatePasswordResetRequest = (data) => {
  const schema = Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.base': 'Email must be a string',
        'string.email': 'Email must be a valid email address',
        'any.required': 'Email is required'
      })
  });
  
  return schema.validate(data);
};

// Validate password reset
exports.validatePasswordReset = (data) => {
  const schema = Joi.object({
    token: Joi.string()
      .required()
      .messages({
        'string.base': 'Token must be a string',
        'any.required': 'Token is required'
      }),
    
    newPassword: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.base': 'Password must be a string',
        'string.min': 'Password must be at least {#limit} characters long',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'Password is required'
      })
  });
  
  return schema.validate(data);
};

// Validate 2FA verification
exports.validate2FAVerification = (data) => {
  const schema = Joi.object({
    userId: Joi.string()
      .required()
      .messages({
        'string.base': 'User ID must be a string',
        'any.required': 'User ID is required'
      }),
    
    code: Joi.string()
      .length(6)
      .pattern(/^\d+$/)
      .required()
      .messages({
        'string.base': 'Code must be a string',
        'string.length': 'Code must be {#limit} characters long',
        'string.pattern.base': 'Code must contain only digits',
        'any.required': 'Code is required'
      }),
    
    tempToken: Joi.string()
      .required()
      .messages({
        'string.base': 'Temporary token must be a string',
        'any.required': 'Temporary token is required'
      })
  });
  
  return schema.validate(data);
};

// Validate 2FA setup verification
exports.validate2FASetupVerification = (data) => {
  const schema = Joi.object({
    code: Joi.string()
      .length(6)
      .pattern(/^\d+$/)
      .required()
      .messages({
        'string.base': 'Code must be a string',
        'string.length': 'Code must be {#limit} characters long',
        'string.pattern.base': 'Code must contain only digits',
        'any.required': 'Code is required'
      })
  });
  
  return schema.validate(data);
};

// Validate 2FA disable
exports.validate2FADisable = (data) => {
  const schema = Joi.object({
    password: Joi.string()
      .required()
      .messages({
        'string.base': 'Password must be a string',
        'any.required': 'Password is required'
      })
  });
  
  return schema.validate(data);
};
```

### 9. Main Server File

```javascript
// auth-service/src/server.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { redisClient } = require('./config/redis.config');
const { verifyConnection } = require('./utils/email.util');
const logger = require('./utils/logger.util');
const authRoutes = require('./routes/auth.routes');

// Environment variables
const {
  PORT = 3001,
  MONGODB_URI,
  NODE_ENV = 'development'
} = process.env;

// Create Express app
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Routes
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'auth-service',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred'
    }
  });
});

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    logger.info('Connected to MongoDB');
    
    // Verify email service connection
    return verifyConnection();
  })
  .then(() => {
    // Start server
    app.listen(PORT, () => {
      logger.info(`Auth service running on port ${PORT}`);
    });
  })
  .catch((error) => {
    logger.error(`Server initialization error: ${error.message}`);
    process.exit(1);
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});

// Handle SIGTERM
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Close MongoDB connection
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
  
  // Close Redis connection
  await redisClient.quit();
  logger.info('Redis connection closed');
  
  process.exit(0);
});
```

## Integration with Other Services

The authentication service integrates with other services through secure API calls and message queues. Here's how it works:

1. **API Gateway Integration**:
   - The API Gateway routes authentication requests to the Auth Service
   - It validates JWT tokens for protected endpoints across all services
   - It handles rate limiting and basic request validation

2. **User Service Integration**:
   - The Auth Service communicates with the User Service for profile management
   - User profile updates trigger events that are consumed by the Auth Service

3. **Notification Service Integration**:
   - Authentication events (login, registration, password reset) trigger notifications
   - These are sent through a message queue to the Notification Service

## Security Considerations

1. **Password Security**:
   - Passwords are hashed using bcrypt with a work factor of 12
   - Password complexity requirements are enforced
   - Failed login attempts are tracked and accounts are temporarily locked after multiple failures

2. **Token Security**:
   - Short-lived access tokens (15 minutes)
   - Refresh token rotation on each use
   - Token blacklisting for revoked tokens
   - Secure cookie attributes

3. **Two-Factor Authentication**:
   - TOTP-based 2FA using speakeasy
   - QR code generation for easy setup
   - Recovery codes for account access if 2FA device is lost

4. **Rate Limiting**:
   - IP-based rate limiting for sensitive endpoints
   - Graduated rate limiting based on endpoint sensitivity

5. **Data Protection**:
   - Sensitive data is encrypted at rest
   - PII is handled according to data protection regulations
   - Minimal data exposure in responses

## Testing Strategy

1. **Unit Tests**:
   - Test individual functions and methods
   - Mock external dependencies

2. **Integration Tests**:
   - Test API endpoints with a test database
   - Verify authentication flows

3. **Security Tests**:
   - Test for common vulnerabilities (OWASP Top 10)
   - Verify rate limiting and brute force protection

## Deployment Considerations

1. **Environment Variables**:
   - All sensitive configuration is stored in environment variables
   - Different configurations for development, testing, and production

2. **Containerization**:
   - Service is containerized using Docker
   - Can be deployed as part of a Kubernetes cluster

3. **Monitoring**:
   - Comprehensive logging for security events
   - Performance monitoring for authentication operations
   - Alert system for suspicious activities