const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');

class AuthService {
  // Validate email format
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate password strength
  validatePassword(password) {
    return password && password.length >= 8;
  }

  // Register a new user
  async registerUser(userData) {
    const { email, password, firstName, lastName } = userData;

    // Validate input
    if (!this.validateEmail(email)) {
      throw new Error('Invalid email format');
    }

    if (!this.validatePassword(password)) {
      throw new Error('Password must be at least 8 characters');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new user
    const user = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName
    });

    await user.save();
    return user;
  }

  // Login user
  async loginUser(credentials) {
    const { email, password } = credentials;

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if account is active
    if (user.status !== 'active' && !user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email,
        role: user.role 
      },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    return {
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    };
  }

  // Verify JWT token
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
      
      const user = await User.findById(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      if (error.message === 'User not found') {
        throw error;
      }
      throw new Error('Invalid token');
    }
  }

  // Generate password reset token
  async generatePasswordResetToken(email) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new Error('User not found');
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour

    await user.save();
    return resetToken;
  }

  // Reset password
  async resetPassword(token, newPassword) {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    if (!this.validatePassword(newPassword)) {
      throw new Error('Password must be at least 8 characters');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await user.save();
    return user;
  }

  // Update user profile
  async updateProfile(userId, updateData) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Update allowed fields
    const allowedFields = ['firstName', 'lastName', 'profile'];
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        user[key] = updateData[key];
      }
    });

    await user.save();
    return user;
  }

  // Enable 2FA
  async enable2FA(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `QuantumMint (${user.email})`,
      issuer: 'QuantumMint'
    });

    user.twoFactorEnabled = true;
    user.twoFactorSecret = secret.base32;

    await user.save();

    // Generate QR code
    const qrCode = await qrcode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCode
    };
  }

  // Verify 2FA token
  async verify2FA(userId, token) {
    const user = await User.findById(userId);
    if (!user || !user.twoFactorEnabled) {
      return false;
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2
    });

    return verified;
  }

  // Disable 2FA
  async disable2FA(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;

    await user.save();
    return user;
  }

  // Get user profile
  async getUserProfile(userId) {
    const user = await User.findById(userId).select('-password -twoFactorSecret');
    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  // Change password
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    if (!this.validatePassword(newPassword)) {
      throw new Error('Password must be at least 8 characters');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;

    await user.save();
    return user;
  }

  // Verify email
  async verifyEmail(token) {
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!user) {
      throw new Error('Invalid or expired verification token');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    user.status = 'active';

    await user.save();
    return user;
  }
}

module.exports = new AuthService();
