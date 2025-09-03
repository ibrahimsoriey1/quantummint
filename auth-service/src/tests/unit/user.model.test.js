const bcrypt = require('bcrypt');
const User = require('../../models/user.model');
const mongoose = require('mongoose');

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}));

describe('User Model', () => {
  let userData;

  beforeEach(() => {
    userData = {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'Password123!',
      phoneNumber: '+1234567890',
      dateOfBirth: new Date('1990-01-01'),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Schema Validation', () => {
    test('should validate a valid user', async () => {
      const user = new User(userData);
      const error = user.validateSync();
      expect(error).toBeUndefined();
    });

    test('should require email', async () => {
      const user = new User({ ...userData, email: undefined });
      const error = user.validateSync();
      expect(error.errors.email).toBeDefined();
    });

    test('should require valid email format', async () => {
      const user = new User({ ...userData, email: 'invalid-email' });
      const error = user.validateSync();
      expect(error.errors.email).toBeDefined();
    });

    test('should require password', async () => {
      const user = new User({ ...userData, password: undefined });
      const error = user.validateSync();
      expect(error.errors.password).toBeDefined();
    });

    test('should require firstName', async () => {
      const user = new User({ ...userData, firstName: undefined });
      const error = user.validateSync();
      expect(error.errors.firstName).toBeDefined();
    });

    test('should require lastName', async () => {
      const user = new User({ ...userData, lastName: undefined });
      const error = user.validateSync();
      expect(error.errors.lastName).toBeDefined();
    });
  });

  describe('Pre-save Middleware', () => {
    test('should hash password before saving', async () => {
      const user = new User(userData);
      
      // Mock the save method to prevent actual database operation
      user.save = jest.fn().mockResolvedValue(user);
      
      // Manually trigger the pre-save middleware
      await user.schema.pre('save', function(next) {
        this.password = userData.password; // Ensure password is set
        this.isModified = jest.fn().mockReturnValue(true); // Mock isModified to return true
        next();
      }).bind(user)(jest.fn());
      
      // Call save to trigger the middleware
      await user.save();
      
      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 10);
    });

    test('should not hash password if not modified', async () => {
      const user = new User(userData);
      
      // Mock the save method to prevent actual database operation
      user.save = jest.fn().mockResolvedValue(user);
      
      // Manually trigger the pre-save middleware
      await user.schema.pre('save', function(next) {
        this.password = userData.password; // Ensure password is set
        this.isModified = jest.fn().mockReturnValue(false); // Mock isModified to return false
        next();
      }).bind(user)(jest.fn());
      
      // Call save to trigger the middleware
      await user.save();
      
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });
  });

  describe('Methods', () => {
    test('comparePassword should return true for correct password', async () => {
      const user = new User(userData);
      const result = await user.comparePassword('Password123!');
      expect(bcrypt.compare).toHaveBeenCalledWith('Password123!', userData.password);
      expect(result).toBe(true);
    });

    test('comparePassword should return false for incorrect password', async () => {
      bcrypt.compare.mockResolvedValueOnce(false);
      const user = new User(userData);
      const result = await user.comparePassword('WrongPassword');
      expect(bcrypt.compare).toHaveBeenCalledWith('WrongPassword', userData.password);
      expect(result).toBe(false);
    });
  });
});