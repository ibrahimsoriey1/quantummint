const mongoose = require('mongoose');
const Generation = require('../../models/generation.model');

describe('Generation Model', () => {
  let generationData;

  beforeEach(() => {
    generationData = {
      userId: new mongoose.Types.ObjectId(),
      walletId: new mongoose.Types.ObjectId(),
      amount: 1000,
      method: 'standard',
      status: 'completed',
      fee: 0,
      purpose: 'Test generation',
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Schema Validation', () => {
    test('should validate a valid generation', async () => {
      const generation = new Generation(generationData);
      const error = generation.validateSync();
      expect(error).toBeUndefined();
    });

    test('should require userId', async () => {
      const generation = new Generation({ ...generationData, userId: undefined });
      const error = generation.validateSync();
      expect(error.errors.userId).toBeDefined();
    });

    test('should require walletId', async () => {
      const generation = new Generation({ ...generationData, walletId: undefined });
      const error = generation.validateSync();
      expect(error.errors.walletId).toBeDefined();
    });

    test('should require amount', async () => {
      const generation = new Generation({ ...generationData, amount: undefined });
      const error = generation.validateSync();
      expect(error.errors.amount).toBeDefined();
    });

    test('should require method', async () => {
      const generation = new Generation({ ...generationData, method: undefined });
      const error = generation.validateSync();
      expect(error.errors.method).toBeDefined();
    });

    test('should require status', async () => {
      const generation = new Generation({ ...generationData, status: undefined });
      const error = generation.validateSync();
      expect(error.errors.status).toBeDefined();
    });

    test('should validate method is one of the allowed values', async () => {
      const generation = new Generation({ ...generationData, method: 'INVALID' });
      const error = generation.validateSync();
      expect(error.errors.method).toBeDefined();
    });

    test('should validate status is one of the allowed values', async () => {
      const generation = new Generation({ ...generationData, status: 'INVALID' });
      const error = generation.validateSync();
      expect(error.errors.status).toBeDefined();
    });

    test('should validate amount is a positive number', async () => {
      const generation = new Generation({ ...generationData, amount: -100 });
      const error = generation.validateSync();
      expect(error.errors.amount).toBeDefined();
    });

    test('should validate fee is a non-negative number', async () => {
      const generation = new Generation({ ...generationData, fee: -10 });
      const error = generation.validateSync();
      expect(error.errors.fee).toBeDefined();
    });
  });

  describe('Virtuals', () => {
    test('should have a netAmount virtual', () => {
      const generation = new Generation({ ...generationData, amount: 1000, fee: 50 });
      expect(generation.netAmount).toBe(950);
    });

    test('should have a formattedAmount virtual', () => {
      const generation = new Generation(generationData);
      expect(generation.formattedAmount).toBe('$1,000.00');
    });

    test('should have a formattedFee virtual', () => {
      const generation = new Generation({ ...generationData, fee: 50 });
      expect(generation.formattedFee).toBe('$50.00');
    });

    test('should have a formattedNetAmount virtual', () => {
      const generation = new Generation({ ...generationData, amount: 1000, fee: 50 });
      expect(generation.formattedNetAmount).toBe('$950.00');
    });
  });

  describe('Timestamps', () => {
    test('should have createdAt and updatedAt fields', () => {
      const generation = new Generation(generationData);
      expect(generation.createdAt).toBeDefined();
      expect(generation.updatedAt).toBeDefined();
    });
  });

  describe('Methods', () => {
    test('should have a calculateFee method', () => {
      const generation = new Generation(generationData);
      expect(typeof generation.calculateFee).toBe('function');
    });

    test('calculateFee method should set fee based on method', () => {
      const generation = new Generation({ ...generationData, method: 'express', amount: 1000 });
      generation.calculateFee();
      expect(generation.fee).toBe(50); // Assuming express method has 5% fee
    });

    test('calculateFee method should set fee to 0 for standard method', () => {
      const generation = new Generation({ ...generationData, method: 'standard', amount: 1000 });
      generation.calculateFee();
      expect(generation.fee).toBe(0);
    });

    test('calculateFee method should set fee to 10% for premium method', () => {
      const generation = new Generation({ ...generationData, method: 'premium', amount: 1000 });
      generation.calculateFee();
      expect(generation.fee).toBe(100);
    });
  });
});