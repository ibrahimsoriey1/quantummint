const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const User = require('../../../shared/models/User');
const logger = require('../../../shared/utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');

// Setup two-factor authentication
const setupTwoFactor = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (user.twoFactorEnabled) {
    return res.status(400).json({
      success: false,
      message: 'Two-factor authentication is already enabled'
    });
  }

  // Generate secret
  const secret = speakeasy.generateSecret({
    name: `QuantumMint (${user.email})`,
    issuer: 'QuantumMint',
    length: 32
  });

  // Store temporary secret (not saved until verified)
  const tempSecret = secret.base32;

  // Generate QR code
  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

  logger.info('2FA setup initiated', {
    userId: user._id,
    email: user.email
  });

  res.json({
    success: true,
    message: '2FA setup initiated. Scan the QR code with your authenticator app',
    data: {
      secret: tempSecret,
      qrCode: qrCodeUrl,
      manualEntryKey: tempSecret,
      backupCodes: user.generateBackupCodes()
    }
  });
});

// Verify and enable two-factor authentication
const verifyTwoFactor = asyncHandler(async (req, res) => {
  const { secret, token } = req.body;

  const user = await User.findById(req.user.id);

  if (user.twoFactorEnabled) {
    return res.status(400).json({
      success: false,
      message: 'Two-factor authentication is already enabled'
    });
  }

  // Verify the token
  const verified = speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 2
  });

  if (!verified) {
    return res.status(400).json({
      success: false,
      message: 'Invalid verification code'
    });
  }

  // Enable 2FA
  user.twoFactorEnabled = true;
  user.twoFactorSecret = secret;
  await user.save();

  logger.info('2FA enabled successfully', {
    userId: user._id,
    email: user.email
  });

  res.json({
    success: true,
    message: 'Two-factor authentication enabled successfully',
    data: {
      backupCodes: user.backupCodes.map(bc => bc.code)
    }
  });
});

// Disable two-factor authentication
const disableTwoFactor = asyncHandler(async (req, res) => {
  const { password, token } = req.body;

  const user = await User.findById(req.user.id).select('+password');

  if (!user.twoFactorEnabled) {
    return res.status(400).json({
      success: false,
      message: 'Two-factor authentication is not enabled'
    });
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      message: 'Invalid password'
    });
  }

  // Verify 2FA token or backup code
  let isValidToken = false;

  if (token) {
    // Try TOTP first
    isValidToken = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 2
    });

    // If TOTP fails, try backup code
    if (!isValidToken) {
      isValidToken = user.useBackupCode(token);
    }
  }

  if (!isValidToken) {
    return res.status(401).json({
      success: false,
      message: 'Invalid two-factor authentication code'
    });
  }

  // Disable 2FA
  user.twoFactorEnabled = false;
  user.twoFactorSecret = undefined;
  user.backupCodes = [];
  await user.save();

  logger.info('2FA disabled', {
    userId: user._id,
    email: user.email
  });

  res.json({
    success: true,
    message: 'Two-factor authentication disabled successfully'
  });
});

// Generate new backup codes
const generateBackupCodes = asyncHandler(async (req, res) => {
  const { password } = req.body;

  const user = await User.findById(req.user.id).select('+password');

  if (!user.twoFactorEnabled) {
    return res.status(400).json({
      success: false,
      message: 'Two-factor authentication is not enabled'
    });
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      message: 'Invalid password'
    });
  }

  // Generate new backup codes
  const backupCodes = user.generateBackupCodes();
  await user.save();

  logger.info('New backup codes generated', {
    userId: user._id,
    email: user.email
  });

  res.json({
    success: true,
    message: 'New backup codes generated successfully',
    data: {
      backupCodes
    }
  });
});

// Verify two-factor token (for login process)
const verifyToken = asyncHandler(async (req, res) => {
  const { tempToken, token } = req.body;

  try {
    // Verify temporary token
    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    
    if (!decoded.temp) {
      return res.status(401).json({
        success: false,
        message: 'Invalid temporary token'
      });
    }

    const user = await User.findById(decoded.userId);

    if (!user || !user.twoFactorEnabled) {
      return res.status(401).json({
        success: false,
        message: 'Invalid request'
      });
    }

    // Verify 2FA token
    const isValidToken = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 2
    });

    let isValidBackupCode = false;
    if (!isValidToken) {
      isValidBackupCode = user.useBackupCode(token);
      if (isValidBackupCode) {
        await user.save();
      }
    }

    if (!isValidToken && !isValidBackupCode) {
      return res.status(401).json({
        success: false,
        message: 'Invalid two-factor authentication code'
      });
    }

    // Generate full access token
    const accessToken = CryptoUtils.generateJWT(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      process.env.JWT_EXPIRES_IN
    );

    const refreshToken = CryptoUtils.generateJWT(
      { userId: user._id, type: 'refresh' },
      process.env.REFRESH_TOKEN_SECRET,
      process.env.REFRESH_TOKEN_EXPIRES_IN
    );

    // Update login info
    user.lastLoginAt = new Date();
    user.lastLoginIP = req.ip;
    await user.resetLoginAttempts();
    await user.save();

    logger.info('2FA verification successful', {
      userId: user._id,
      email: user.email,
      backupCodeUsed: isValidBackupCode
    });

    res.json({
      success: true,
      message: 'Two-factor authentication successful',
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
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN
        }
      }
    });

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid temporary token'
    });
  }
});

module.exports = {
  setupTwoFactor,
  verifyTwoFactor,
  disableTwoFactor,
  generateBackupCodes,
  verifyToken
};
