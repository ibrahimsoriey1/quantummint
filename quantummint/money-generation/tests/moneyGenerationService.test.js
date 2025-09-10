// Mock dependencies
jest.mock('../src/models/MoneyGeneration', () => {
  const mockMoneyGeneration = jest.fn();
  mockMoneyGeneration.findById = jest.fn();
  mockMoneyGeneration.find = jest.fn();
  mockMoneyGeneration.aggregate = jest.fn();
  mockMoneyGeneration.countDocuments = jest.fn();
  return mockMoneyGeneration;
});

jest.mock('../src/models/User', () => ({
  findById: jest.fn()
}));

const moneyGenerationService = require('../src/services/moneyGenerationService');
const MoneyGeneration = require('../src/models/MoneyGeneration');
const User = require('../src/models/User');

describe('Money Generation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createGenerationRequest', () => {
    it('should create a new generation request successfully', async () => {
      const requestData = {
        userId: 'user-id',
        amount: 1000,
        complexity: 'medium',
        description: 'Test generation'
      };

      const mockRequest = {
        _id: 'generation-id',
        userId: 'user-id',
        amount: 1000,
        status: 'pending',
        save: jest.fn().mockResolvedValue(true)
      };

      const mockUser = {
        _id: 'user-id',
        kycStatus: 'verified',
        dailyGenerationLimit: 5000,
        monthlyGenerationLimit: 50000
      };

      MoneyGeneration.mockImplementation(() => mockRequest);
      User.findById = jest.fn().mockResolvedValue(mockUser);
      MoneyGeneration.aggregate = jest.fn().mockResolvedValue([
        { _id: null, totalAmount: 500 }
      ]);

      const result = await moneyGenerationService.createGenerationRequest(requestData);

      expect(MoneyGeneration).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user-id',
        amount: 1000,
        complexity: 'medium'
      }));
      expect(mockRequest.save).toHaveBeenCalled();
    });

    it('should throw error for non-verified user', async () => {
      const requestData = {
        userId: 'user-id',
        amount: 1000
      };

      const mockUser = {
        _id: 'user-id',
        kycStatus: 'pending'
      };

      User.findById = jest.fn().mockResolvedValue(mockUser);

      await expect(moneyGenerationService.createGenerationRequest(requestData))
        .rejects.toThrow('KYC verification required');
    });

    it('should throw error for exceeding daily limit', async () => {
      const requestData = {
        userId: 'user-id',
        amount: 6000
      };

      const mockUser = {
        _id: 'user-id',
        kycStatus: 'verified',
        dailyGenerationLimit: 5000
      };

      User.findById = jest.fn().mockResolvedValue(mockUser);
      MoneyGeneration.aggregate = jest.fn().mockResolvedValue([
        { _id: null, totalAmount: 4000 }
      ]);

      await expect(moneyGenerationService.createGenerationRequest(requestData))
        .rejects.toThrow('Daily generation limit exceeded');
    });

    it('should validate minimum and maximum amounts', async () => {
      const invalidData = {
        userId: 'user-id',
        amount: 10 // Below minimum
      };

      await expect(moneyGenerationService.createGenerationRequest(invalidData))
        .rejects.toThrow('Amount must be between');
    });
  });

  describe('processGeneration', () => {
    it('should process generation request successfully', async () => {
      const mockRequest = {
        _id: 'generation-id',
        userId: 'user-id',
        amount: 1000,
        complexity: 'medium',
        status: 'pending',
        startTime: null,
        endTime: null,
        save: jest.fn().mockResolvedValue(true),
        startProcessing: jest.fn(function() {
          this.status = 'processing';
          this.startTime = new Date();
        }),
        complete: jest.fn(),
        fail: jest.fn()
      };

      MoneyGeneration.findById = jest.fn().mockResolvedValue(mockRequest);

      // Mock the quantum processing
      const mockQuantumProcessor = {
        processGeneration: jest.fn().mockResolvedValue({
          success: true,
          generatedAmount: 1000,
          processingTime: 5000
        })
      };

      const result = await moneyGenerationService.processGeneration('generation-id', mockQuantumProcessor);

      expect(mockRequest.status).toBe('processing');
      expect(mockRequest.startTime).toBeDefined();
      expect(mockRequest.save).toHaveBeenCalled();
    });

    it('should handle generation failure', async () => {
      const mockRequest = {
        _id: 'generation-id',
        status: 'processing',
        save: jest.fn().mockResolvedValue(true),
        startProcessing: jest.fn(),
        complete: jest.fn(),
        fail: jest.fn(function(errorMessage) {
          this.status = 'failed';
          this.endTime = new Date();
          this.errorMessage = errorMessage;
        })
      };

      MoneyGeneration.findById = jest.fn().mockResolvedValue(mockRequest);

      const mockQuantumProcessor = {
        processGeneration: jest.fn().mockRejectedValue(new Error('Quantum processing failed'))
      };

      try {
        await moneyGenerationService.processGeneration('generation-id', mockQuantumProcessor);
      } catch (error) {
        // Expected to throw error
      }

      expect(mockRequest.fail).toHaveBeenCalledWith('Quantum processing failed');
      expect(mockRequest.status).toBe('failed');
      expect(mockRequest.errorMessage).toContain('Quantum processing failed');
    });
  });

  describe('calculateComplexity', () => {
    it('should calculate complexity based on amount', () => {
      expect(moneyGenerationService.calculateComplexity(100)).toBe('low');
      expect(moneyGenerationService.calculateComplexity(1000)).toBe('medium');
      expect(moneyGenerationService.calculateComplexity(10000)).toBe('high');
      expect(moneyGenerationService.calculateComplexity(100000)).toBe('extreme');
    });
  });

  describe('estimateProcessingTime', () => {
    it('should estimate processing time based on complexity and amount', () => {
      const estimate1 = moneyGenerationService.estimateProcessingTime(100, 'low');
      const estimate2 = moneyGenerationService.estimateProcessingTime(1000, 'medium');
      const estimate3 = moneyGenerationService.estimateProcessingTime(10000, 'high');

      expect(estimate1).toBeLessThan(estimate2);
      expect(estimate2).toBeLessThan(estimate3);
      expect(estimate1).toBeGreaterThan(0);
    });
  });

  describe('getGenerationHistory', () => {
    it('should return generation history with pagination', async () => {
      const mockHistory = [
        { _id: 'gen1', userId: 'user-id', amount: 1000, status: 'completed' },
        { _id: 'gen2', userId: 'user-id', amount: 2000, status: 'completed' }
      ];

      MoneyGeneration.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockHistory)
          })
        })
      });

      MoneyGeneration.countDocuments = jest.fn().mockResolvedValue(2);

      const result = await moneyGenerationService.getGenerationHistory('user-id', 1, 10);

      expect(result.generations).toEqual(mockHistory);
      expect(result.pagination.total).toBe(2);
    });
  });

  describe('getGenerationStats', () => {
    it('should return generation statistics', async () => {
      const mockStats = [
        {
          _id: { status: 'completed' },
          count: 10,
          totalAmount: 10000,
          avgAmount: 1000
        },
        {
          _id: { status: 'failed' },
          count: 2,
          totalAmount: 0,
          avgAmount: 0
        }
      ];

      MoneyGeneration.aggregate = jest.fn().mockResolvedValue(mockStats);

      const result = await moneyGenerationService.getGenerationStats('user-id');

      expect(result.completed.count).toBe(10);
      expect(result.completed.totalAmount).toBe(10000);
      expect(result.failed.count).toBe(2);
    });
  });

  describe('validateGenerationLimits', () => {
    it('should validate daily limits', async () => {
      const mockUser = {
        dailyGenerationLimit: 5000,
        monthlyGenerationLimit: 50000
      };

      MoneyGeneration.aggregate = jest.fn()
        .mockResolvedValueOnce([{ _id: null, totalAmount: 3000 }]) // Daily
        .mockResolvedValueOnce([{ _id: null, totalAmount: 20000 }]); // Monthly

      const result = await moneyGenerationService.validateGenerationLimits(
        'user-id',
        1000,
        mockUser
      );

      expect(result.canGenerate).toBe(true);
      expect(result.dailyRemaining).toBe(2000);
      expect(result.monthlyRemaining).toBe(30000);
    });

    it('should reject when daily limit exceeded', async () => {
      const mockUser = {
        dailyGenerationLimit: 5000,
        monthlyGenerationLimit: 50000
      };

      MoneyGeneration.aggregate = jest.fn()
        .mockResolvedValueOnce([{ _id: null, totalAmount: 4500 }]) // Daily
        .mockResolvedValueOnce([{ _id: null, totalAmount: 20000 }]); // Monthly

      const result = await moneyGenerationService.validateGenerationLimits(
        'user-id',
        1000,
        mockUser
      );

      expect(result.canGenerate).toBe(false);
      expect(result.reason).toContain('Daily generation limit');
    });
  });

  describe('updateGenerationStatus', () => {
    it('should update generation status successfully', async () => {
      const mockGeneration = {
        _id: 'generation-id',
        status: 'processing',
        save: jest.fn().mockResolvedValue(true)
      };

      MoneyGeneration.findById = jest.fn().mockResolvedValue(mockGeneration);

      const result = await moneyGenerationService.updateGenerationStatus(
        'generation-id',
        'completed',
        { generatedAmount: 1000 }
      );

      expect(mockGeneration.status).toBe('completed');
      expect(mockGeneration.generatedAmount).toBe(1000);
      expect(mockGeneration.save).toHaveBeenCalled();
    });

    it('should throw error for non-existent generation', async () => {
      MoneyGeneration.findById = jest.fn().mockResolvedValue(null);

      await expect(moneyGenerationService.updateGenerationStatus('invalid-id', 'completed'))
        .rejects.toThrow('Generation request not found');
    });
  });

  describe('cancelGeneration', () => {
    it('should cancel pending generation', async () => {
      const mockGeneration = {
        _id: 'generation-id',
        status: 'pending',
        save: jest.fn().mockResolvedValue(true)
      };

      MoneyGeneration.findById = jest.fn().mockResolvedValue(mockGeneration);

      const result = await moneyGenerationService.cancelGeneration('generation-id');

      expect(mockGeneration.status).toBe('cancelled');
      expect(mockGeneration.save).toHaveBeenCalled();
    });

    it('should not cancel completed generation', async () => {
      const mockGeneration = {
        _id: 'generation-id',
        status: 'completed'
      };

      MoneyGeneration.findById = jest.fn().mockResolvedValue(mockGeneration);

      await expect(moneyGenerationService.cancelGeneration('generation-id'))
        .rejects.toThrow('Cannot cancel completed generation');
    });
  });
});
