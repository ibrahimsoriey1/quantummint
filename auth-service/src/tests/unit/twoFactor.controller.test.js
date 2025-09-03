const twoFactorController = require('../../controllers/twoFactor.controller');
const User = require('../../models/user.model');
const TwoFactorAuth = require('../../models/twoFactor.model');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

// Mock dependencies
jest.mock('../../models/user.model');
jest.mock('../../models/twoFactor.model');
jest.mock('jsonwebtoken');
jest.mock('speakeasy');
jest.mock('qrcode');

describe('Two-Factor Authentication Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      user: { id: 'user-id', email: 'test@example.com' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('setup', () => {
    beforeEach(() => {
      // Mock User.findById to return a user
      User.findById.mockResolvedValue({
        _id: 'user-id',
        email: 'test@example.com',
        twoFactorEnabled: false,
      });

      // Mock speakeasy.generateSecret to return a secret
      speakeasy.generateSecret.mockReturnValue({
        base32: 'test-secret',
        otpauth_url: 'otpauth://totp/QuantumMint:test@example.com?secret=test-secret&issuer=QuantumMint',
      });

      // Mock qrcode.toDataURL to return a QR code
      qrcode.toDataURL.mockResolvedValue('data:image/png;base64,test-qr-code');

      // Mock TwoFactorAuth.findOneAndUpdate to return the updated document
      TwoFactorAuth.findOneAndUpdate.mockResolvedValue({
        _id: 'twoFactor-id',
        userId: 'user-id',
        secret: 'test-secret',
        verified: false,
      });
    });

    test('should setup two-factor authentication successfully', async () => {
      await twoFactorController.setup(req, res, next);

      expect(User.findById).toHaveBeenCalledWith('user-id');
      expect(speakeasy.generateSecret).toHaveBeenCalledWith({
        name: 'QuantumMint:test@example.com',
        length: 20,
      });
      expect(qrcode.toDataURL).toHaveBeenCalledWith('otpauth://totp/QuantumMint:test@example.com?secret=test-secret&issuer=QuantumMint');
      expect(TwoFactorAuth.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'user-id' },
        {
          userId: 'user-id',
          secret: 'test-secret',
          verified: false,
        },
        { upsert: true, new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        secretKey: 'test-secret',
        qrCodeUrl: 'data:image/png;base64,test-qr-code',
      });
    });

    test('should return error if user not found', async () => {
      // Mock User.findById to return null
      User.findById.mockResolvedValue(null);

      await twoFactorController.setup(req, res, next);

      expect(User.findById).toHaveBeenCalledWith('user-id');
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 404,
        message: 'User not found',
      }));
    });

    test('should return error if two-factor is already enabled', async () => {
      // Mock User.findById to return a user with 2FA enabled
      User.findById.mockResolvedValue({
        _id: 'user-id',
        email: 'test@example.com',
        twoFactorEnabled: true,
      });

      await twoFactorController.setup(req, res, next);

      expect(User.findById).toHaveBeenCalledWith('user-id');
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 400,
        message: 'Two-factor authentication is already enabled',
      }));
    });

    test('should handle errors during setup', async () => {
      // Mock speakeasy.generateSecret to throw an error
      speakeasy.generateSecret.mockImplementation(() => {
        throw new Error('Failed to generate secret');
      });

      await twoFactorController.setup(req, res, next);

      expect(User.findById).toHaveBeenCalledWith('user-id');
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('enable', () => {
    beforeEach(() => {
      req.body = {
        code: '123456',
      };

      // Mock TwoFactorAuth.findOne to return a two-factor auth record
      TwoFactorAuth.findOne.mockResolvedValue({
        _id: 'twoFactor-id',
        userId: 'user-id',
        secret: 'test-secret',
        verified: false,
      });

      // Mock speakeasy.totp.verify to return true
      speakeasy.totp.verify.mockReturnValue(true);

      // Mock User.findByIdAndUpdate to return the updated user
      User.findByIdAndUpdate.mockResolvedValue({
        _id: 'user-id',
        email: 'test@example.com',
        twoFactorEnabled: true,
      });

      // Mock TwoFactorAuth.findOneAndUpdate to return the updated record
      TwoFactorAuth.findOneAndUpdate.mockResolvedValue({
        _id: 'twoFactor-id',
        userId: 'user-id',
        secret: 'test-secret',
        verified: true,
      });
    });

    test('should enable two-factor authentication successfully', async () => {
      await twoFactorController.enable(req, res, next);

      expect(TwoFactorAuth.findOne).toHaveBeenCalledWith({ userId: 'user-id' });
      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret: 'test-secret',
        encoding: 'base32',
        token: '123456',
      });
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user-id',
        { twoFactorEnabled: true },
        { new: true }
      );
      expect(TwoFactorAuth.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'twoFactor-id' },
        { verified: true },
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Two-factor authentication enabled successfully',
      });
    });

    test('should return error if two-factor record not found', async () => {
      // Mock TwoFactorAuth.findOne to return null
      TwoFactorAuth.findOne.mockResolvedValue(null);

      await twoFactorController.enable(req, res, next);

      expect(TwoFactorAuth.findOne).toHaveBeenCalledWith({ userId: 'user-id' });
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 404,
        message: 'Two-factor authentication not set up',
      }));
    });

    test('should return error if verification code is invalid', async () => {
      // Mock speakeasy.totp.verify to return false
      speakeasy.totp.verify.mockReturnValue(false);

      await twoFactorController.enable(req, res, next);

      expect(TwoFactorAuth.findOne).toHaveBeenCalledWith({ userId: 'user-id' });
      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret: 'test-secret',
        encoding: 'base32',
        token: '123456',
      });
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 400,
        message: 'Invalid verification code',
      }));
    });

    test('should handle errors during enabling', async () => {
      // Mock User.findByIdAndUpdate to throw an error
      User.findByIdAndUpdate.mockRejectedValue(new Error('Database error'));

      await twoFactorController.enable(req, res, next);

      expect(TwoFactorAuth.findOne).toHaveBeenCalledWith({ userId: 'user-id' });
      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret: 'test-secret',
        encoding: 'base32',
        token: '123456',
      });
      expect(User.findByIdAndUpdate).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('verify', () => {
    beforeEach(() => {
      req.body = {
        email: 'test@example.com',
        code: '123456',
      };

      // Mock User.findOne to return a user
      User.findOne.mockResolvedValue({
        _id: 'user-id',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        role: 'user',
        twoFactorEnabled: true,
      });

      // Mock TwoFactorAuth.findOne to return a two-factor auth record
      TwoFactorAuth.findOne.mockResolvedValue({
        _id: 'twoFactor-id',
        userId: 'user-id',
        secret: 'test-secret',
        verified: true,
      });

      // Mock speakeasy.totp.verify to return true
      speakeasy.totp.verify.mockReturnValue(true);

      // Mock jwt.sign to return a token
      jwt.sign.mockReturnValue('access-token');
    });

    test('should verify two-factor authentication successfully', async () => {
      await twoFactorController.verify(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(TwoFactorAuth.findOne).toHaveBeenCalledWith({ userId: 'user-id' });
      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret: 'test-secret',
        encoding: 'base32',
        token: '123456',
      });
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

      await twoFactorController.verify(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 404,
        message: 'User not found',
      }));
    });

    test('should return error if two-factor is not enabled', async () => {
      // Mock User.findOne to return a user without 2FA enabled
      User.findOne.mockResolvedValue({
        _id: 'user-id',
        email: 'test@example.com',
        twoFactorEnabled: false,
      });

      await twoFactorController.verify(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 400,
        message: 'Two-factor authentication is not enabled for this user',
      }));
    });

    test('should return error if two-factor record not found', async () => {
      // Mock TwoFactorAuth.findOne to return null
      TwoFactorAuth.findOne.mockResolvedValue(null);

      await twoFactorController.verify(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(TwoFactorAuth.findOne).toHaveBeenCalledWith({ userId: 'user-id' });
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 404,
        message: 'Two-factor authentication not set up',
      }));
    });

    test('should return error if verification code is invalid', async () => {
      // Mock speakeasy.totp.verify to return false
      speakeasy.totp.verify.mockReturnValue(false);

      await twoFactorController.verify(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(TwoFactorAuth.findOne).toHaveBeenCalledWith({ userId: 'user-id' });
      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret: 'test-secret',
        encoding: 'base32',
        token: '123456',
      });
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 400,
        message: 'Invalid verification code',
      }));
    });

    test('should handle errors during verification', async () => {
      // Mock User.findOne to throw an error
      User.findOne.mockRejectedValue(new Error('Database error'));

      await twoFactorController.verify(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // Additional test cases for other controller methods can be added here
});