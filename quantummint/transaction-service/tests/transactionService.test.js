// Mock the models first
jest.mock('../src/models/Transaction', () => {
  const mockTransaction = {
    save: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    aggregate: jest.fn(),
    findOneAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
    startSession: jest.fn(() => ({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn()
    }))
  };
  const MockTransaction = jest.fn(() => mockTransaction);
  Object.assign(MockTransaction, mockTransaction);
  return MockTransaction;
});

jest.mock('../src/models/Balance', () => {
  const mockBalance = {
    findOne: jest.fn(),
    save: jest.fn()
  };
  return mockBalance;
});

const transactionService = require('../src/services/transactionService');
const Transaction = require('../src/models/Transaction');
const Balance = require('../src/models/Balance');

describe('Transaction Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTransaction', () => {
    it('should create a new transaction successfully', async () => {
      const mockTransaction = {
        _id: 'transaction-id',
        userId: 'user-id',
        type: 'credit',
        amount: 100,
        status: 'completed',
        save: jest.fn().mockResolvedValue(true)
      };

      Transaction.mockImplementation(() => mockTransaction);
      Balance.findOne = jest.fn().mockResolvedValue({
        userId: 'user-id',
        available: 500,
        locked: 0,
        save: jest.fn().mockResolvedValue(true)
      });

      const transactionData = {
        userId: 'user-id',
        type: 'credit',
        amount: 100,
        description: 'Test transaction'
      };

      const result = await transactionService.createTransaction(transactionData);

      expect(result).toBeDefined();
      expect(Transaction).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user-id',
        type: 'credit',
        amount: 100
      }));
    });

    it('should throw error for invalid transaction data', async () => {
      const invalidData = {
        userId: 'user-id',
        type: 'invalid-type',
        amount: -100
      };

      await expect(transactionService.createTransaction(invalidData))
        .rejects.toThrow();
    });

    it('should handle insufficient funds for debit transactions', async () => {
      const mockTransaction = {
        _id: 'transaction-id',
        userId: 'user-id',
        type: 'debit',
        amount: 1000,
        status: 'pending',
        save: jest.fn().mockResolvedValue(true)
      };

      Transaction.mockImplementation(() => mockTransaction);
      Balance.findOne = jest.fn().mockResolvedValue({
        userId: 'user-id',
        balances: [{
          currency: 'QMC',
          available: 500,
          locked: 0,
          total: 500
        }]
      });
      
      // Mock balanceService to throw insufficient funds error
      const balanceService = require('../src/services/balanceService');
      balanceService.getUserBalance = jest.fn().mockResolvedValue({
        userId: 'user-id',
        balances: [{
          currency: 'QMC',
          available: 500,
          locked: 0,
          total: 500
        }]
      });

      const transactionData = {
        fromUserId: 'user-id',
        type: 'debit',
        amount: 1000,
        description: 'Test debit transaction'
      };

      await expect(transactionService.createTransaction(transactionData))
        .rejects.toThrow('Insufficient funds');
    });
  });

  describe('updateTransactionStatus', () => {
    it('should update transaction status successfully', async () => {
      const mockTransaction = {
        _id: 'transaction-id',
        status: 'completed',
        save: jest.fn().mockResolvedValue(true)
      };

      Transaction.findOneAndUpdate = jest.fn().mockResolvedValue(mockTransaction);

      const result = await transactionService.updateTransactionStatus('transaction-id', 'completed');

      expect(result.status).toBe('completed');
      expect(Transaction.findOneAndUpdate).toHaveBeenCalledWith(
        { transactionId: 'transaction-id' },
        { status: 'completed', processedAt: expect.any(Date) },
        { new: true }
      );
    });

    it('should throw error for non-existent transaction', async () => {
      Transaction.findOneAndUpdate = jest.fn().mockResolvedValue(null);

      await expect(transactionService.updateTransactionStatus('invalid-id', 'completed'))
        .rejects.toThrow('Transaction not found');
    });
  });

  describe('getTransactionsByUser', () => {
    it('should return user transactions with pagination', async () => {
      const mockTransactions = [
        { _id: 'tx1', userId: 'user-id', amount: 100 },
        { _id: 'tx2', userId: 'user-id', amount: 200 }
      ];

      Transaction.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockTransactions)
          })
        })
      });

      Transaction.countDocuments = jest.fn().mockResolvedValue(2);

      const result = await transactionService.getTransactionsByUser('user-id', 1, 10);

      expect(result.transactions).toEqual(mockTransactions);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
    });

    it('should handle empty transaction list', async () => {
      Transaction.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([])
          })
        })
      });

      Transaction.countDocuments = jest.fn().mockResolvedValue(0);

      const result = await transactionService.getTransactionsByUser('user-id', 1, 10);

      expect(result.transactions).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('validateTransactionData', () => {
    it('should validate correct transaction data', () => {
      const validData = {
        userId: 'user-id',
        type: 'credit',
        amount: 100,
        description: 'Valid transaction'
      };

      expect(() => transactionService.validateTransactionData(validData))
        .not.toThrow();
    });

    it('should reject invalid transaction type', () => {
      const invalidData = {
        userId: 'user-id',
        type: 'invalid',
        amount: 100
      };

      expect(() => transactionService.validateTransactionData(invalidData))
        .toThrow();
    });

    it('should reject negative amounts', () => {
      const invalidData = {
        userId: 'user-id',
        type: 'credit',
        amount: -100
      };

      expect(() => transactionService.validateTransactionData(invalidData))
        .toThrow();
    });
  });

  describe('getTransactionStats', () => {
    it('should return transaction statistics', async () => {
      const mockStats = [
        {
          _id: { type: 'credit', status: 'completed' },
          count: 5,
          totalAmount: 500
        },
        {
          _id: { type: 'debit', status: 'completed' },
          count: 3,
          totalAmount: 300
        }
      ];

      Transaction.aggregate = jest.fn().mockResolvedValue(mockStats);

      const result = await transactionService.getTransactionStats('user-id');

      expect(result).toBeDefined();
      expect(Transaction.aggregate).toHaveBeenCalled();
    });
  });
});
