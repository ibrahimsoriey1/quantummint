const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');
const User = require('../models/user.model');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const { redisClient } = require('../config/redis');
const jwt = require('jsonwebtoken');
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
 * @returns {String} Refresh token
 */
const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString('hex');
};

/**
 * Generate 2FA setup
 * @route GET /api/2fa/setup
 */
exports.generateSetup = async (req, res, next) => {
  try {
    const user = req.user;
    
    // Generate secret
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `${process.env.TOTP_ISSUER || 'QuantumMint'}:${user.email}`
    });
    
    // Store secret temporarily
    await redisClient.set(`2fa_setup:${user._id}`, secret.base32, 'EX', 600); // Expire in 10 minutes
    
    // Generate QR code
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);
    
    res.status(200).json({
      success: true,
      data: {
        secret: secret.base32,
        qrCode: qrCodeUrl
      }
    });
  } catch (error) {
    logger.error(`Generate 2FA setup error: ${error.message}`);
    next(error);
  }
};

/**
 * Enable 2FA
 * @route POST /api/2fa/enable
 */
exports.enableTwoFactor = async (req, res, next) => {
  try {
    const { token } = req.body;
    const user = req.user;
    
    // Get secret from Redis
    const secret = await redisClient.get(`2fa_setup:${user._id}`);
    
    if (!secret) {
      return next(new ApiError(400, '2FA setup expired. Please start setup again.'));
    }
    
    // Verify token
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1 // Allow 1 step before/after for clock drift
    });
    
    if (!verified) {
      return next(new ApiError(400, 'Invalid verification code'));
    }
    
    // Enable 2FA
    user.twoFactorEnabled = true;
    user.twoFactorSecret = secret;
    await user.save();
    
    // Delete temporary secret
    await redisClient.del(`2fa_setup:${user._id}`);
    
    // Generate backup codes (in a real implementation)
    const backupCodes = Array(10)
      .fill()
      .map(() => crypto.randomBytes(4).toString('hex'))
      .join(' ');
    
    res.status(200).json({
      success: true,
      message: 'Two-factor authentication enabled successfully',
      backupCodes
    });
  } catch (error) {
    logger.error(`Enable 2FA error: ${error.message}`);
    next(error);
  }
};

/**
 * Verify 2FA token during login
 * @route POST /api/2fa/verify
 */
exports.verifyToken = async (req, res, next) => {
  try {
    const { userId, token, twoFactorToken } = req.body;
    
    // Verify 2FA token from login
    const storedUserId = await redisClient.get(`2fa:${twoFactorToken}`);
    
    if (!storedUserId || storedUserId !== userId) {
      return next(new ApiError(400, 'Invalid or expired session. Please log in again.'));
    }
    
    // Find user
    const user = await User.findById(userId).select('+twoFactorSecret');
    
    if (!user) {
      return next(new ApiError(404, 'User not found'));
    }
    
    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1 // Allow 1 step before/after for clock drift
    });
    
    if (!verified) {
      return next(new ApiError(400, 'Invalid verification code'));
    }
    
    // Delete 2FA token
    await redisClient.del(`2fa:${twoFactorToken}`);
    
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
    logger.error(`Verify 2FA token error: ${error.message}`);
    next(error);
  }
};

/**
 * Disable 2FA
 * @route POST /api/2fa/disable
 */
exports.disableTwoFactor = async (req, res, next) => {
  try {
    const { token } = req.body;
    const user = await User.findById(req.user._id).select('+twoFactorSecret');
    
    if (!user.twoFactorEnabled) {
      return next(new ApiError(400, 'Two-factor authentication is not enabled'));
    }
    
    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1 // Allow 1 step before/after for clock drift
    });
    
    if (!verified) {
      return next(new ApiError(400, 'Invalid verification code'));
    }
    
    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Two-factor authentication disabled successfully'
    });
  } catch (error) {
    logger.error(`Disable 2FA error: ${error.message}`);
    next(error);
  }
};

/**
 * Generate backup codes
 * @route GET /api/2fa/backup-codes
 */
exports.generateBackupCodes = async (req, res, next) => {
  try {
    const user = req.user;
    
    if (!user.twoFactorEnabled) {
      return next(new ApiError(400, 'Two-factor authentication is not enabled'));
    }
    
    // Generate backup codes (in a real implementation, these would be hashed and stored)
    const backupCodes = Array(10)
      .fill()
      .map(() => crypto.randomBytes(4).toString('hex'))
      .join(' ');
    
    res.status(200).json({
      success: true,
      backupCodes
    });
  } catch (error) {
    logger.error(`Generate backup codes error: ${error.message}`);
    next(error);
  }
};