// Mock for MongoDB connection
const mongoose = require('mongoose');

// Mock User model
const mockUserModel = {
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findOneAndUpdate: jest.fn(),
};

// Mock TwoFactorAuth model
const mockTwoFactorAuthModel = {
  findOne: jest.fn(),
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findOneAndDelete: jest.fn(),
};

// Mock Token model
const mockTokenModel = {
  findOne: jest.fn(),
  create: jest.fn(),
  findOneAndDelete: jest.fn(),
  deleteMany: jest.fn(),
};

// Mock mongoose connection
const mockConnection = {
  on: jest.fn(),
  once: jest.fn(),
};

// Mock mongoose connect function
mongoose.connect = jest.fn().mockResolvedValue(mockConnection);

module.exports = {
  mongoose,
  mockUserModel,
  mockTwoFactorAuthModel,
  mockTokenModel,
  mockConnection,
};