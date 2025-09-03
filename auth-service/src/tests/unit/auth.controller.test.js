const authController = require('../../controllers/auth.controller');
const User = require('../../models/user.model');
const Token = require('../../models/token.model');
const TwoFactorAuth = require('../../models/twoFactor.model');
const { sendEmail } = require('../../utils/email');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

// Mock dependencies
jest.mock('../../models/user.model');
jest.mock('../../models/token.model');
jest.mock('../../models/twoFactor.model');
jest.mock('../../utils/email');
jest.mock('jsonwebtoken');
jest.mock('bcrypt');
jest.mock('speakeasy');
jest.mock('qrcode');
jest.mock('uuid');

describe('Auth Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      user: { id: 'user-id' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('register', () => {
    beforeEach(() => {
      req.body = {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'Password123!',
        phoneNumber: '+1234567890',
        dateOfBirth: '1990-01-01',
      };

      // Mock User.findOne to return null (user doesn't exist)
      User.findOne.mockResolvedValue(null);

      // Mock User.create to return a new user
      User.create.mockResolvedValue({
        _id: 'user-id',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        role: 'user',
      });

      // Mock Token.create to return a new token
      Token.create.mockResolvedValue({
        _id: 'token-id',
        userId: 'user-id',
        token: 'verification-token',
        type: 'email-verification',
      });

      // Mock uuidv4 to return a fixed token
      uuidv4.mockReturnValue('verification-token');

      // Mock sendEmail to resolve successfully
      sendEmail.mockResolvedValue(true);
    });

    test('should register a new user successfully', async () => {
      await authController.register(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(User.create).toHaveBeenCalledWith({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'Password123!',
        phoneNumber: '+1234567890',
        dateOfBirth: expect.any(Date),
      });
      expect(Token.create).toHaveBeenCalledWith({
        userId: 'user-id',
        token: 'verification-token',
        type: 'email-verification',
      });
      expect(sendEmail).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
      });
    });

    test('should return error if user already exists', async () => {
      // Mock User.findOne to return an existing user
      User.findOne.mockResolvedValue({
        _id: 'existing-user-id',
        email: 'test@example.com',
      });

      await authController.register(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(User.create).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 409,
        message: 'Email already in use',
      }));
    });

    test('should handle errors during registration', async () => {
      // Mock User.create to throw an error
      User.create.mockRejectedValue(new Error('Database error'));

      await authController.register(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(User.create).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('login', () => {
    beforeEach(() => {
      req.body = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      // Mock User.findOne to return a user
      User.findOne.mockResolvedValue({
        _id: 'user-id',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'hashed-password',
        role: 'user',
        isVerified: true,
        twoFactorEnabled: false,
        comparePassword: jest.fn().mockResolvedValue(true),
      });

      // Mock jwt.sign to return a token
      jwt.sign.mockReturnValue('access-token');
    });

    test('should login user successfully', async () => {
      await authController.login(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(jwt.sign).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'access-token',
        user: expect.objectContaining({
          id: 'user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          role: 'user',
        }),
      });
    });

    test('should return error if user not found', async () => {
      // Mock User.findOne to return null
      User.findOne.mockResolvedValue(null);

      await authController.login(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 401,
        message: 'Invalid email or password',
      }));
    });

    test('should return error if password is incorrect', async () => {
      // Mock comparePassword to return false
      const mockUser = {
        _id: 'user-id',
        email: 'test@example.com',
        password: 'hashed-password',
        isVerified: true,
        comparePassword: jest.fn().mockResolvedValue(false),
      };
      User.findOne.mockResolvedValue(mockUser);

      await authController.login(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(mockUser.comparePassword).toHaveBeenCalledWith('Password123!');
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 401,
        message: 'Invalid email or password',
      }));
    });

    test('should return error if account is not verified', async () => {
      // Mock User.findOne to return an unverified user
      User.findOne.mockResolvedValue({
        _id: 'user-id',
        email: 'test@example.com',
        password: 'hashed-password',
        isVerified: false,
        comparePassword: jest.fn().mockResolvedValue(true),
      });

      await authController.login(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 401,
        message: 'Please verify your email before logging in',
      }));
    });

    test('should require two-factor authentication if enabled', async () => {
      // Mock User.findOne to return a user with 2FA enabled
      User.findOne.mockResolvedValue({
        _id: 'user-id',
        email: 'test@example.com',
        password: 'hashed-password',
        isVerified: true,
        twoFactorEnabled: true,
        comparePassword: jest.fn().mockResolvedValue(true),
      });

      await authController.login(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        twoFactorRequired: true,
        message: 'Two-factor authentication required',
      });
    });
  });

  describe('verifyEmail', () => {
    beforeEach(() => {
      req.params.token = 'verification-token';

      // Mock Token.findOne to return a token
      Token.findOne.mockResolvedValue({
        _id: 'token-id',
        userId: 'user-id',
        token: 'verification-token',
        type: 'email-verification',
      });

      // Mock User.findByIdAndUpdate to return the updated user
      User.findByIdAndUpdate.mockResolvedValue({
        _id: 'user-id',
        email: 'test@example.com',
        isVerified: true,
      });

      // Mock Token.findOneAndDelete to return the deleted token
      Token.findOneAndDelete.mockResolvedValue({
        _id: 'token-id',
      });
    });

    test('should verify email successfully', async () => {
      await authController.verifyEmail(req, res, next);

      expect(Token.findOne).toHaveBeenCalledWith({
        token: 'verification-token',
        type: 'email-verification',
      });
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user-id',
        { isVerified: true },
        { new: true }
      );
      expect(Token.findOneAndDelete).toHaveBeenCalledWith({
        _id: 'token-id',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Email verified successfully. You can now log in.',
      });
    });

    test('should return error if token not found', async () => {
      // Mock Token.findOne to return null
      Token.findOne.mockResolvedValue(null);

      await authController.verifyEmail(req, res, next);

      expect(Token.findOne).toHaveBeenCalledWith({
        token: 'verification-token',
        type: 'email-verification',
      });
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 400,
        message: 'Invalid or expired verification token',
      }));
    });

    test('should handle errors during verification', async () => {
      // Mock User.findByIdAndUpdate to throw an error
      User.findByIdAndUpdate.mockRejectedValue(new Error('Database error'));

      await authController.verifyEmail(req, res, next);

      expect(Token.findOne).toHaveBeenCalledWith({
        token: 'verification-token',
        type: 'email-verification',
      });
      expect(User.findByIdAndUpdate).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // Additional test cases for other controller methods can be added here
});