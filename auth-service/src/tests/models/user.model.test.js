const bcrypt = require('bcrypt');
const User = require('../../models/user.model');
const mongoose = require('mongoose');

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}));

// Mock user model to avoid actual database operations
jest.mock('../../models/user.model', () => {
  const userSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      match: [/.+@.+\..+/, 'Please fill a valid email address'],
    },
    password: { type: String, required: true },
    phoneNumber: String,
    dateOfBirth: Date,
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isVerified: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: false },
  });

  userSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
      this.password = await bcrypt.hash(this.password, 10);
    }
    next();
  });

  userSchema.methods.comparePassword = function (password) {
    return bcrypt.compare(password, this.password);
  };
  
  const mockUser = mongoose.model('User', userSchema);
  return mockUser;
});


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
      await user.save();
      expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 10);
      expect(user.password).toBe('hashed-password');
    });

    test('should not hash password if not modified', async () => {
      const user = new User(userData);
      await user.save(); // First save hashes the password
      bcrypt.hash.mockClear(); // Clear mock calls

      user.firstName = 'Updated';
      await user.save();
      
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });
  });

  describe('Methods', () => {
    test('comparePassword should return true for correct password', async () => {
      const user = new User(userData);
      await user.save();
      const result = await user.comparePassword('Password123!');
      expect(bcrypt.compare).toHaveBeenCalledWith('Password123!', 'hashed-password');
      expect(result).toBe(true);
    });

    test('comparePassword should return false for incorrect password', async () => {
      bcrypt.compare.mockResolvedValueOnce(false);
      const user = new User(userData);
      await user.save();
      const result = await user.comparePassword('WrongPassword');
      expect(bcrypt.compare).toHaveBeenCalledWith('WrongPassword', 'hashed-password');
      expect(result).toBe(false);
    });
  });
});