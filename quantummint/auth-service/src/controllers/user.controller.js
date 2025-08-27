const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const crypto = require('crypto');
const User = require('../models/user.model');
const KYCVerification = require('../models/kyc-verification.model');
const { publishEvent } = require('../utils/event.util');
const logger = require('../utils/logger.util');

/**
 * Get user profile
 */
exports.getProfile = async (req, res) => {
  try {
    const { userId } = req.user;
    
    // Find user
    const user = await User.findById(userId).select('-passwordHash -salt -twoFactorSecret -recoveryCodes');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }
    
    // Get KYC status
    const kycStatus = await KYCVerification.findOne({ userId }).sort({ createdAt: -1 }).select('verificationStatus');
    
    return res.status(200).json({
      success: true,
      data: {
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        countryCode: user.countryCode,
        dateOfBirth: user.dateOfBirth,
        address: user.address,
        kycStatus: kycStatus ? kycStatus.verificationStatus : 'not_submitted',
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    logger.error(`Get profile error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while retrieving user profile'
      }
    });
  }
};

/**
 * Update user profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const { userId } = req.user;
    const {
      firstName,
      lastName,
      phoneNumber,
      address
    } = req.body;
    
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
    
    // Check if phone number is being changed and if it's already in use
    if (phoneNumber && phoneNumber !== user.phoneNumber) {
      const existingUser = await User.findOne({ phoneNumber });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'DUPLICATE_PHONE',
            message: 'This phone number is already in use'
          }
        });
      }
    }
    
    // Update user
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (address) user.address = address;
    
    await user.save();
    
    // Publish user updated event
    await publishEvent('user.updated', {
      userId: user._id.toString(),
      username: user.username,
      email: user.email
    });
    
    logger.info(`User profile updated: ${userId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        userId: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        address: user.address
      }
    });
  } catch (error) {
    logger.error(`Update profile error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating user profile'
      }
    });
  }
};

/**
 * Change password
 */
exports.changePassword = async (req, res) => {
  try {
    const { userId } = req.user;
    const { currentPassword, newPassword } = req.body;
    
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
    
    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Current password is incorrect'
        }
      });
    }
    
    // Hash new password
    const { hash, salt } = await User.hashPassword(newPassword);
    
    // Update user password
    user.passwordHash = hash;
    user.salt = salt;
    await user.save();
    
    logger.info(`Password changed for user: ${userId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error(`Change password error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while changing password'
      }
    });
  }
};

/**
 * Enable two-factor authentication
 */
exports.enableTwoFactor = async (req, res) => {
  try {
    const { userId } = req.user;
    
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
    
    // Check if 2FA is already enabled
    if (user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_ENABLED',
          message: 'Two-factor authentication is already enabled'
        }
      });
    }
    
    // Generate secret
    const secret = authenticator.generateSecret();
    
    // Store secret temporarily
    user.twoFactorSecret = secret;
    await user.save();
    
    // Generate QR code
    const otpauth = authenticator.keyuri(user.email, 'QuantumMint', secret);
    const qrCodeUrl = await qrcode.toDataURL(otpauth);
    
    logger.info(`2FA setup initiated for user: ${userId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Two-factor authentication setup initiated',
      data: {
        secret,
        qrCodeUrl
      }
    });
  } catch (error) {
    logger.error(`Enable 2FA error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while enabling two-factor authentication'
      }
    });
  }
};

/**
 * Verify and complete two-factor authentication setup
 */
exports.verifyTwoFactorSetup = async (req, res) => {
  try {
    const { userId } = req.user;
    const { code } = req.body;
    
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
    
    // Check if 2FA is already enabled
    if (user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_ENABLED',
          message: 'Two-factor authentication is already enabled'
        }
      });
    }
    
    // Verify code
    const isValid = authenticator.verify({
      token: code,
      secret: user.twoFactorSecret
    });
    
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CODE',
          message: 'Invalid verification code'
        }
      });
    }
    
    // Generate recovery codes
    const recoveryCodes = Array(10).fill(0).map(() => 
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );
    
    // Enable 2FA
    user.twoFactorEnabled = true;
    user.recoveryCodes = recoveryCodes;
    await user.save();
    
    logger.info(`2FA enabled for user: ${userId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Two-factor authentication enabled successfully',
      data: {
        recoveryCodes
      }
    });
  } catch (error) {
    logger.error(`Verify 2FA setup error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while verifying two-factor authentication setup'
      }
    });
  }
};

/**
 * Disable two-factor authentication
 */
exports.disableTwoFactor = async (req, res) => {
  try {
    const { userId } = req.user;
    const { password } = req.body;
    
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
    
    // Check if 2FA is enabled
    if (!user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NOT_ENABLED',
          message: 'Two-factor authentication is not enabled'
        }
      });
    }
    
    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Password is incorrect'
        }
      });
    }
    
    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.recoveryCodes = [];
    await user.save();
    
    logger.info(`2FA disabled for user: ${userId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Two-factor authentication disabled successfully'
    });
  } catch (error) {
    logger.error(`Disable 2FA error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while disabling two-factor authentication'
      }
    });
  }
};

/**
 * Submit KYC information
 */
exports.submitKYC = async (req, res) => {
  try {
    const { userId } = req.user;
    const {
      idType,
      idNumber,
      idExpiryDate
    } = req.body;
    
    // Get file paths from middleware
    const documentFrontImage = req.files.documentFront[0].path;
    const documentBackImage = req.files.documentBack ? req.files.documentBack[0].path : null;
    const selfieImage = req.files.selfie[0].path;
    
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
    
    // Check if KYC is already submitted and pending or verified
    const existingKYC = await KYCVerification.findOne({
      userId,
      verificationStatus: { $in: ['pending', 'verified'] }
    });
    
    if (existingKYC) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_SUBMITTED',
          message: `KYC verification is already ${existingKYC.verificationStatus}`
        }
      });
    }
    
    // Create KYC verification record
    const kycVerification = new KYCVerification({
      userId,
      verificationType: 'identity',
      documentType: idType,
      documentNumber: idNumber,
      documentExpiryDate: new Date(idExpiryDate),
      documentFrontImage,
      documentBackImage,
      selfieImage,
      verificationStatus: 'pending'
    });
    
    await kycVerification.save();
    
    // Publish KYC submitted event
    await publishEvent('kyc.submitted', {
      userId,
      verificationId: kycVerification._id.toString(),
      documentType: idType
    });
    
    logger.info(`KYC submitted for user: ${userId}`);
    
    return res.status(200).json({
      success: true,
      message: 'KYC information submitted successfully',
      data: {
        verificationId: kycVerification._id.toString(),
        status: 'pending'
      }
    });
  } catch (error) {
    logger.error(`KYC submission error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while submitting KYC information'
      }
    });
  }
};

/**
 * Get KYC status
 */
exports.getKYCStatus = async (req, res) => {
  try {
    const { userId } = req.user;
    
    // Find latest KYC verification
    const kycVerification = await KYCVerification.findOne({ userId }).sort({ createdAt: -1 });
    
    if (!kycVerification) {
      return res.status(200).json({
        success: true,
        data: {
          status: 'not_submitted'
        }
      });
    }
    
    return res.status(200).json({
      success: true,
      data: {
        verificationId: kycVerification._id.toString(),
        status: kycVerification.verificationStatus,
        submittedAt: kycVerification.createdAt,
        verifiedAt: kycVerification.verifiedAt,
        rejectionReason: kycVerification.rejectionReason
      }
    });
  } catch (error) {
    logger.error(`Get KYC status error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while retrieving KYC status'
      }
    });
  }
};