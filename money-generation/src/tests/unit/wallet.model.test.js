const mongoose = require('mongoose');
const Wallet = require('../../models/wallet.model');

describe('Wallet Model', () => {
  let walletData;

  beforeEach(() => {
    walletData = {
      userId: new mongoose.Types.ObjectId(),
      balance: 1000,
      currency: 'USD',
      type: 'standard',
      status: 'active',
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Schema Validation', () => {
    test('should validate a valid wallet', async () => {
      const wallet = new Wallet(walletData);
      const error = wallet.validateSync();
      expect(error).toBeUndefined();
    });

    test('should require userId', async () => {
      const wallet = new Wallet({ ...walletData, userId: undefined });
      const error = wallet.validateSync();
      expect(error.errors.userId).toBeDefined();
    });

    test('should require balance', async () => {
      const wallet = new Wallet({ ...walletData, balance: undefined });
      const error = wallet.validateSync();
      expect(error.errors.balance).toBeDefined();
    });

    test('should require currency', async () => {
      const wallet = new Wallet({ ...walletData, currency: undefined });
      const error = wallet.validateSync();
      expect(error.errors.currency).toBeDefined();
    });

    test('should require type', async () => {
      const wallet = new Wallet({ ...walletData, type: undefined });
      const error = wallet.validateSync();
      expect(error.errors.type).toBeDefined();
    });

    test('should require status', async () => {
      const wallet = new Wallet({ ...walletData, status: undefined });
      const error = wallet.validateSync();
      expect(error.errors.status).toBeDefined();
    });

    test('should validate currency is one of the allowed values', async () => {
      const wallet = new Wallet({ ...walletData, currency: 'INVALID' });
      const error = wallet.validateSync();
      expect(error.errors.currency).toBeDefined();
    });

    test('should validate type is one of the allowed values', async () => {
      const wallet = new Wallet({ ...walletData, type: 'INVALID' });
      const error = wallet.validateSync();
      expect(error.errors.type).toBeDefined();
    });

    test('should validate status is one of the allowed values', async () => {
      const wallet = new Wallet({ ...walletData, status: 'INVALID' });
      const error = wallet.validateSync();
      expect(error.errors.status).toBeDefined();
    });

    test('should validate balance is a positive number', async () => {
      const wallet = new Wallet({ ...walletData, balance: -100 });
      const error = wallet.validateSync();
      expect(error.errors.balance).toBeDefined();
    });
  });

  describe('Methods', () => {
    test('should have a deposit method', () => {
      const wallet = new Wallet(walletData);
      expect(typeof wallet.deposit).toBe('function');
    });

    test('should have a withdraw method', () => {
      const wallet = new Wallet(walletData);
      expect(typeof wallet.withdraw).toBe('function');
    });

    test('deposit method should increase balance', () => {
      const wallet = new Wallet(walletData);
      wallet.deposit(500);
      expect(wallet.balance).toBe(1500);
    });

    test('withdraw method should decrease balance', () => {
      const wallet = new Wallet(walletData);
      wallet.withdraw(500);
      expect(wallet.balance).toBe(500);
    });

    test('withdraw method should throw error if insufficient balance', () => {
      const wallet = new Wallet(walletData);
      expect(() => wallet.withdraw(1500)).toThrow('Insufficient balance');
    });
  });

  describe('Virtuals', () => {
    test('should have a formattedBalance virtual', () => {
      const wallet = new Wallet(walletData);
      expect(wallet.formattedBalance).toBe('$1,000.00');
    });
  });

  describe('Timestamps', () => {
    test('should have createdAt and updatedAt fields', () => {
      const wallet = new Wallet(walletData);
      expect(wallet.createdAt).toBeDefined();
      expect(wallet.updatedAt).toBeDefined();
    });
  });
});