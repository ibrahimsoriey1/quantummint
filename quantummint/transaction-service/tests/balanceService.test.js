// Mock the Balance model first
jest.mock('../src/models/Balance', () => {
  const mockBalance = {
    findOne: jest.fn(),
    save: jest.fn(),
    aggregate: jest.fn(),
    startSession: jest.fn(() => ({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn()
    }))
  };
  const MockBalance = jest.fn(() => mockBalance);
  Object.assign(MockBalance, mockBalance);
  return MockBalance;
});

const balanceService = require('../src/services/balanceService');
const Balance = require('../src/models/Balance');

describe('Balance Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserBalance', () => {
    it('should return user balance when exists', async () => {
      const mockBalance = {
        userId: 'user-id',
        balances: [{
          currency: 'QMC',
          available: 1000,
          locked: 100,
          total: 1100
        }],
        version: 1
      };

      Balance.findOne = jest.fn().mockResolvedValue(mockBalance);

      const result = await balanceService.getUserBalance('user-id');

      expect(result).toEqual(mockBalance);
      expect(Balance.findOne).toHaveBeenCalledWith({ userId: 'user-id' });
    });

    it('should return null when balance does not exist', async () => {
      Balance.findOne = jest.fn().mockResolvedValue(null);

      const result = await balanceService.getUserBalance('non-existent-user');

      expect(result).toBeNull();
    });
  });

  describe('initializeBalance', () => {
    it('should create new balance for user', async () => {
      const mockBalance = {
        userId: 'user-id',
        available: 0,
        locked: 0,
        currency: 'USD',
        save: jest.fn().mockResolvedValue(true)
      };

      Balance.mockImplementation(() => mockBalance);
      Balance.findOne = jest.fn().mockResolvedValue(null);

      const result = await balanceService.initializeBalance('user-id');

      expect(Balance).toHaveBeenCalledWith({
        userId: 'user-id',
        balances: [{
          currency: 'QMC',
          available: 0,
          locked: 0,
          total: 0
        }]
      });
      expect(mockBalance.save).toHaveBeenCalled();
    });

    it('should not create balance if already exists', async () => {
      const existingBalance = {
        userId: 'user-id',
        balances: [{
          currency: 'QMC',
          available: 100,
          locked: 0,
          total: 100
        }]
      };

      Balance.findOne = jest.fn().mockResolvedValue(existingBalance);

      const result = await balanceService.initializeBalance('user-id');

      expect(result).toEqual(existingBalance);
      expect(Balance).not.toHaveBeenCalled();
    });
  });

  describe('addFunds', () => {
    it('should add funds to available balance', async () => {
      const mockBalance = {
        userId: 'user-id',
        balances: [{
          currency: 'QMC',
          available: 1000,
          locked: 100,
          total: 1100
        }],
        save: jest.fn().mockResolvedValue(true)
      };

      Balance.findOne = jest.fn().mockResolvedValue(mockBalance);

      const result = await balanceService.addFunds('user-id', 200, 'QMC', 'Test deposit');

      expect(mockBalance.balances[0].available).toBe(1200);
      expect(mockBalance.save).toHaveBeenCalled();
    });

    it('should throw error for negative amount', async () => {
      await expect(balanceService.addFunds('user-id', -100, 'Invalid'))
        .rejects.toThrow('Amount must be positive');
    });

    it('should throw error if balance not found', async () => {
      Balance.findOne = jest.fn().mockResolvedValue(null);

      await expect(balanceService.addFunds('user-id', 100, 'QMC', 'Test'))
        .rejects.toThrow('Balance not found');
    });
  });

  describe('deductFunds', () => {
    it('should deduct funds from available balance', async () => {
      const mockBalance = {
        userId: 'user-id',
        balances: [{
          currency: 'QMC',
          available: 500,
          locked: 0,
          total: 500
        }],
        save: jest.fn().mockResolvedValue(true)
      };

      Balance.findOne = jest.fn().mockResolvedValue(mockBalance);

      const result = await balanceService.deductFunds('user-id', 200, 'QMC', 'Test withdrawal');

      expect(mockBalance.balances[0].available).toBe(300);
      expect(mockBalance.save).toHaveBeenCalled();
    });

    it('should throw error for insufficient funds', async () => {
      const mockBalance = {
        userId: 'user-id',
        balances: [{
          currency: 'QMC',
          available: 100,
          locked: 0,
          total: 100
        }]
      };

      Balance.findOne = jest.fn().mockResolvedValue(mockBalance);

      await expect(balanceService.deductFunds('user-id', 200, 'QMC', 'Test'))
        .rejects.toThrow('Insufficient funds');
    });
  });

  describe('lockFunds', () => {
    it('should lock funds successfully', async () => {
      const mockBalance = {
        userId: 'user-id',
        balances: [{
          currency: 'QMC',
          available: 500,
          locked: 100,
          total: 600
        }],
        save: jest.fn().mockResolvedValue(true)
      };

      Balance.findOne = jest.fn().mockResolvedValue(mockBalance);

      const result = await balanceService.lockFunds('user-id', 200, 'QMC', 'Test lock');

      expect(mockBalance.balances[0].available).toBe(300);
      expect(mockBalance.balances[0].locked).toBe(300);
      expect(mockBalance.save).toHaveBeenCalled();
    });

    it('should throw error for insufficient available funds', async () => {
      const mockBalance = {
        userId: 'user-id',
        balances: [{
          currency: 'QMC',
          available: 100,
          locked: 0,
          total: 100
        }]
      };

      Balance.findOne = jest.fn().mockResolvedValue(mockBalance);

      await expect(balanceService.lockFunds('user-id', 200, 'QMC', 'Test'))
        .rejects.toThrow('Insufficient available funds');
    });
  });

  describe('unlockFunds', () => {
    it('should unlock funds successfully', async () => {
      const mockBalance = {
        userId: 'user-id',
        balances: [{
          currency: 'QMC',
          available: 300,
          locked: 200,
          total: 500
        }],
        save: jest.fn().mockResolvedValue(true)
      };

      Balance.findOne = jest.fn().mockResolvedValue(mockBalance);

      const result = await balanceService.unlockFunds('user-id', 100, 'QMC', 'Test unlock');

      expect(mockBalance.balances[0].available).toBe(400);
      expect(mockBalance.balances[0].locked).toBe(100);
      expect(mockBalance.save).toHaveBeenCalled();
    });

    it('should throw error for insufficient locked funds', async () => {
      const mockBalance = {
        userId: 'user-id',
        balances: [{
          currency: 'QMC',
          available: 500,
          locked: 50,
          total: 550
        }]
      };

      Balance.findOne = jest.fn().mockResolvedValue(mockBalance);

      await expect(balanceService.unlockFunds('user-id', 100, 'QMC', 'Test'))
        .rejects.toThrow('Insufficient locked funds');
    });
  });

  describe('transferFunds', () => {
    it('should transfer funds between users', async () => {
      const fromBalance = {
        userId: 'from-user',
        balances: [{
          currency: 'QMC',
          available: 500,
          locked: 0,
          total: 500
        }],
        save: jest.fn().mockResolvedValue(true)
      };

      const toBalance = {
        userId: 'to-user',
        balances: [{
          currency: 'QMC',
          available: 200,
          locked: 0,
          total: 200
        }],
        save: jest.fn().mockResolvedValue(true)
      };

      Balance.findOne = jest.fn()
        .mockResolvedValueOnce(fromBalance)
        .mockResolvedValueOnce(toBalance);

      const result = await balanceService.transferFunds(
        'from-user',
        'to-user',
        100,
        'QMC',
        'Test transfer'
      );

      expect(fromBalance.balances[0].available).toBe(400);
      expect(toBalance.balances[0].available).toBe(300);
      expect(fromBalance.save).toHaveBeenCalled();
      expect(toBalance.save).toHaveBeenCalled();
    });

    it('should throw error for insufficient funds in sender account', async () => {
      const fromBalance = {
        userId: 'from-user',
        balances: [{
          currency: 'QMC',
          available: 50,
          locked: 0,
          total: 50
        }]
      };

      Balance.findOne = jest.fn().mockResolvedValue(fromBalance);

      await expect(balanceService.transferFunds('from-user', 'to-user', 100, 'QMC', 'Test'))
        .rejects.toThrow('Insufficient funds');
    });
  });

  describe('getBalanceHistory', () => {
    it('should return balance history with pagination', async () => {
      const mockHistory = [
        { date: new Date(), available: 500, locked: 0 },
        { date: new Date(), available: 400, locked: 100 }
      ];

      // Mock the aggregation pipeline
      Balance.aggregate = jest.fn().mockResolvedValue(mockHistory);

      const result = await balanceService.getBalanceHistory('user-id', { page: 1, limit: 10 });

      expect(result).toBeDefined();
      expect(Balance.aggregate).toHaveBeenCalled();
    });
  });
});
