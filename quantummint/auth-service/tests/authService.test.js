const authService = require('../src/services/authService');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock dependencies
const mockUser = {
  save: jest.fn(),
  _id: 'user-id',
  email: 'test@example.com'
};

jest.mock('../src/models/User', () => {
  const MockUser = jest.fn(() => mockUser);
  MockUser.findOne = jest.fn();
  MockUser.findById = jest.fn();
  return MockUser;
});
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('speakeasy', () => ({
  generateSecret: jest.fn(),
  totp: {
    verify: jest.fn()
  }
}));
jest.mock('qrcode', () => ({
  toDataURL: jest.fn()
}));

const User = require('../src/models/User');

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerUser', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const hashedPassword = 'hashed_password';
      const mockUser = {
        _id: 'user-id',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        save: jest.fn().mockResolvedValue(true)
      };

      User.findOne.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue(hashedPassword);
      User.mockImplementation(() => mockUser);

      const result = await authService.registerUser(userData);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(mockUser.save).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should throw error if user already exists', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'password123'
      };

      User.findOne.mockResolvedValue({ email: 'existing@example.com' });

      await expect(authService.registerUser(userData))
        .rejects.toThrow('User already exists');
    });

    it('should validate email format', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'password123'
      };

      await expect(authService.registerUser(userData))
        .rejects.toThrow('Invalid email format');
    });

    it('should validate password strength', async () => {
      const userData = {
        email: 'test@example.com',
        password: '123'
      };

      await expect(authService.registerUser(userData))
        .rejects.toThrow('Password must be at least 8 characters');
    });
  });

  describe('loginUser', () => {
    it('should login user with correct credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      const mockUser = {
        _id: 'user-id',
        email: 'test@example.com',
        password: 'hashed_password',
        isActive: true,
        lastLogin: new Date(),
        save: jest.fn().mockResolvedValue(true)
      };

      const mockToken = 'jwt_token';

      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue(mockToken);

      const result = await authService.loginUser(credentials);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed_password');
      expect(jwt.sign).toHaveBeenCalled();
      expect(result.token).toBe(mockToken);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should throw error for non-existent user', async () => {
      const credentials = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      User.findOne = jest.fn().mockResolvedValue(null);

      await expect(authService.loginUser(credentials))
        .rejects.toThrow('Invalid credentials');
    });

    it('should throw error for incorrect password', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const mockUser = {
        _id: 'user-id',
        email: 'test@example.com',
        password: 'hashed_password',
        isActive: true
      };

      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      await expect(authService.loginUser(credentials))
        .rejects.toThrow('Invalid credentials');
    });

    it('should throw error for inactive user', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      const mockUser = {
        _id: 'user-id',
        email: 'test@example.com',
        password: 'hashed_password',
        isActive: false
      };

      User.findOne = jest.fn().mockResolvedValue(mockUser);

      await expect(authService.loginUser(credentials))
        .rejects.toThrow('Account is deactivated');
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      const token = 'valid_token';
      const decoded = { userId: 'user-id', email: 'test@example.com' };
      const mockUser = {
        _id: 'user-id',
        email: 'test@example.com',
        isActive: true
      };

      jwt.verify.mockReturnValue(decoded);
      User.findById.mockResolvedValue(mockUser);

      const result = await authService.verifyToken(token);

      expect(jwt.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET);
      expect(User.findById).toHaveBeenCalledWith('user-id');
      expect(result).toEqual(mockUser);
    });

    it('should throw error for invalid token', async () => {
      const token = 'invalid_token';

      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.verifyToken(token))
        .rejects.toThrow('Invalid token');
    });

    it('should throw error if user not found', async () => {
      const token = 'valid_token';
      const decoded = { userId: 'user-id' };

      jwt.verify.mockReturnValue(decoded);
      User.findById.mockResolvedValue(null);

      await expect(authService.verifyToken(token))
        .rejects.toThrow('User not found');
    });
  });

  describe('resetPassword', () => {
    it('should generate password reset token', async () => {
      const email = 'test@example.com';
      const mockUser = {
        _id: 'user-id',
        email: 'test@example.com',
        resetPasswordToken: null,
        resetPasswordExpires: null,
        save: jest.fn().mockResolvedValue(true)
      };

      User.findOne = jest.fn().mockResolvedValue(mockUser);

      const result = await authService.generatePasswordResetToken(email);

      expect(User.findOne).toHaveBeenCalledWith({ email });
      expect(mockUser.resetPasswordToken).toBeDefined();
      expect(mockUser.resetPasswordExpires).toBeDefined();
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should reset password with valid token', async () => {
      const token = 'reset_token';
      const newPassword = 'newpassword123';
      const hashedPassword = 'hashed_new_password';

      const mockUser = {
        _id: 'user-id',
        resetPasswordToken: token,
        resetPasswordExpires: new Date(Date.now() + 3600000), // 1 hour from now
        password: 'old_password',
        save: jest.fn().mockResolvedValue(true)
      };

      User.findOne.mockResolvedValue(mockUser);
      bcrypt.hash.mockResolvedValue(hashedPassword);

      const result = await authService.resetPassword(token, newPassword);

      expect(User.findOne).toHaveBeenCalledWith({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: expect.any(Date) }
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(mockUser.password).toBe(hashedPassword);
      expect(mockUser.resetPasswordToken).toBeNull();
      expect(mockUser.resetPasswordExpires).toBeNull();
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should throw error for invalid or expired token', async () => {
      const token = 'invalid_token';
      const newPassword = 'newpassword123';

      User.findOne = jest.fn().mockResolvedValue(null);

      await expect(authService.resetPassword(token, newPassword))
        .rejects.toThrow('Invalid or expired reset token');
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const userId = 'user-id';
      const updateData = {
        firstName: 'Jane',
        lastName: 'Smith'
      };

      const mockUser = {
        _id: 'user-id',
        firstName: 'John',
        lastName: 'Doe',
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById = jest.fn().mockResolvedValue(mockUser);

      const result = await authService.updateProfile(userId, updateData);

      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(mockUser.firstName).toBe('Jane');
      expect(mockUser.lastName).toBe('Smith');
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      const userId = 'non-existent-id';
      const updateData = { firstName: 'Jane' };

      User.findById = jest.fn().mockResolvedValue(null);

      await expect(authService.updateProfile(userId, updateData))
        .rejects.toThrow('User not found');
    });
  });

  describe('enable2FA', () => {
    it('should enable 2FA for user', async () => {
      const userId = 'user-id';
      const mockUser = {
        _id: 'user-id',
        twoFactorEnabled: false,
        twoFactorSecret: null,
        save: jest.fn().mockResolvedValue(true)
      };

      const speakeasy = require('speakeasy');
      const qrcode = require('qrcode');
      
      speakeasy.generateSecret.mockReturnValue({
        base32: 'test_secret_base32',
        otpauth_url: 'otpauth://test'
      });
      qrcode.toDataURL.mockResolvedValue('data:image/png;base64,test');
      
      User.findById.mockResolvedValue(mockUser);

      const result = await authService.enable2FA(userId);

      expect(mockUser.twoFactorEnabled).toBe(true);
      expect(mockUser.twoFactorSecret).toBeDefined();
      expect(mockUser.save).toHaveBeenCalled();
      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('qrCode');
    });
  });

  describe('verify2FA', () => {
    it('should verify correct 2FA token', async () => {
      const userId = 'user-id';
      const token = '123456';
      const secret = 'test_secret';

      const mockUser = {
        _id: 'user-id',
        twoFactorEnabled: true,
        twoFactorSecret: secret
      };

      User.findById = jest.fn().mockResolvedValue(mockUser);

      // Mock the TOTP verification
      const mockSpeakeasy = require('speakeasy');
      mockSpeakeasy.totp.verify = jest.fn().mockReturnValue(true);

      const result = await authService.verify2FA(userId, token);

      expect(result).toBe(true);
    });

    it('should reject incorrect 2FA token', async () => {
      const userId = 'user-id';
      const token = '000000';

      const mockUser = {
        _id: 'user-id',
        twoFactorEnabled: true,
        twoFactorSecret: 'test_secret'
      };

      const speakeasy = require('speakeasy');
      speakeasy.totp.verify.mockReturnValue(false);

      User.findById.mockResolvedValue(mockUser);

      const result = await authService.verify2FA(userId, token);

      expect(result).toBe(false);
    });
  });
});
