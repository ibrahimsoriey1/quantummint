const paymentService = require('../src/services/paymentService');
const Payment = require('../src/models/Payment');
const Provider = require('../src/models/Provider');

// Mock dependencies
jest.mock('../src/models/Payment', () => {
  const mockPayment = jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue(true)
  }));
  
  mockPayment.findOne = jest.fn();
  mockPayment.findById = jest.fn();
  mockPayment.find = jest.fn();
  mockPayment.countDocuments = jest.fn();
  mockPayment.aggregate = jest.fn();
  mockPayment.findOneAndUpdate = jest.fn();
  
  return mockPayment;
});

jest.mock('../src/models/Provider', () => ({
  findOne: jest.fn()
}));

jest.mock('stripe', () => {
  return jest.fn(() => ({
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
      confirm: jest.fn()
    },
    refunds: {
      create: jest.fn()
    },
    webhooks: {
      constructEvent: jest.fn()
    }
  }));
});

jest.mock('axios', () => ({
  post: jest.fn()
}));

describe('Payment Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    it('should create a new payment successfully', async () => {
      const paymentData = {
        userId: 'user-id',
        amount: 100,
        currency: 'USD',
        provider: 'stripe',
        method: 'card',
        type: 'card'
      };

      const mockPayment = {
        _id: 'payment-id',
        userId: 'user-id',
        amount: 100,
        status: 'pending',
        save: jest.fn().mockResolvedValue(true)
      };

      const mockProvider = {
        name: 'stripe',
        isActive: true,
        config: { apiKey: 'test-key' },
        limits: {
          card: { min: 1, max: 10000 }
        },
        fees: {
          card: { fixed: 0.30, percentage: 2.9 }
        }
      };

      const Payment = require('../src/models/Payment');
      Payment.mockImplementation(() => mockPayment);
      Provider.findOne = jest.fn().mockResolvedValue(mockProvider);

      const result = await paymentService.createPayment(paymentData);

      expect(Payment).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user-id',
        amount: 100,
        currency: 'USD'
      }));
      expect(mockPayment.save).toHaveBeenCalled();
    });

    it('should throw error for invalid payment amount', async () => {
      const paymentData = {
        userId: 'user-id',
        amount: 50000, // Above max limit
        currency: 'USD',
        provider: 'stripe',
        type: 'card'
      };

      const mockProvider = {
        name: 'stripe',
        isActive: true,
        limits: {
          card: { min: 1, max: 10000 }
        },
        fees: {
          card: { fixed: 0.30, percentage: 2.9 }
        }
      };

      Provider.findOne = jest.fn().mockResolvedValue(mockProvider);

      await expect(paymentService.createPayment(paymentData))
        .rejects.toThrow('Amount must be between 1 and 10000');
    });

    it('should throw error for inactive payment provider', async () => {
      const paymentData = {
        userId: 'user-id',
        amount: 100,
        currency: 'USD',
        provider: 'inactive-provider',
        type: 'card'
      };

      Provider.findOne = jest.fn().mockResolvedValue(null);

      await expect(paymentService.createPayment(paymentData))
        .rejects.toThrow('Provider inactive-provider not found or inactive');
    });
  });

  describe('processPayment', () => {
    it('should process payment successfully', async () => {
      const mockPayment = {
        paymentId: 'payment-id',
        provider: 'stripe',
        status: 'pending',
        save: jest.fn().mockResolvedValue(true)
      };

      Payment.findOne = jest.fn().mockResolvedValue(mockPayment);

      // Mock provider service
      const mockProviderService = {
        processPayment: jest.fn().mockResolvedValue({
          status: 'completed',
          transactionId: 'stripe_tx_123',
          metadata: { fee: 2.9 }
        })
      };

      paymentService.providers = { stripe: mockProviderService };

      const result = await paymentService.processPayment('payment-id', { cardToken: 'tok_123' });

      expect(Payment.findOne).toHaveBeenCalledWith({ paymentId: 'payment-id' });
      expect(mockPayment.save).toHaveBeenCalled();
      expect(result.status).toBe('completed');
    });

    it('should handle payment processing failure', async () => {
      const mockPayment = {
        paymentId: 'payment-id',
        provider: 'stripe',
        status: 'pending',
        save: jest.fn().mockResolvedValue(true)
      };

      Payment.findOne = jest.fn().mockResolvedValue(mockPayment);
      Payment.findOneAndUpdate = jest.fn().mockResolvedValue(true);

      const mockProviderService = {
        processPayment: jest.fn().mockRejectedValue(new Error('Card declined'))
      };

      paymentService.providers = { stripe: mockProviderService };

      await expect(paymentService.processPayment('payment-id', { cardToken: 'tok_123' }))
        .rejects.toThrow('Card declined');
    });
  });

  describe('cancelPayment', () => {
    it('should cancel payment successfully', async () => {
      const mockPayment = {
        paymentId: 'payment-id',
        status: 'pending',
        save: jest.fn().mockResolvedValue(true)
      };

      Payment.findOne = jest.fn().mockResolvedValue(mockPayment);

      const result = await paymentService.cancelPayment('payment-id', 'User requested');

      expect(Payment.findOne).toHaveBeenCalledWith({ paymentId: 'payment-id' });
      expect(mockPayment.status).toBe('cancelled');
      expect(mockPayment.save).toHaveBeenCalled();
    });

    it('should throw error for non-cancellable payment', async () => {
      const mockPayment = {
        paymentId: 'payment-id',
        status: 'completed'
      };

      Payment.findOne = jest.fn().mockResolvedValue(mockPayment);

      await expect(paymentService.cancelPayment('payment-id', 'User requested'))
        .rejects.toThrow('Payment cannot be cancelled');
    });
  });

  describe('getPaymentById', () => {
    it('should get payment by ID successfully', async () => {
      const mockPayment = {
        paymentId: 'payment-id',
        userId: 'user-id',
        amount: 100,
        status: 'completed'
      };

      Payment.findOne = jest.fn().mockResolvedValue(mockPayment);

      const result = await paymentService.getPaymentById('payment-id');

      expect(Payment.findOne).toHaveBeenCalledWith({ paymentId: 'payment-id' });
      expect(result).toEqual(mockPayment);
    });

    it('should throw error for non-existent payment', async () => {
      Payment.findOne = jest.fn().mockResolvedValue(null);

      await expect(paymentService.getPaymentById('invalid-id'))
        .rejects.toThrow('Payment not found');
    });
  });

  describe('updatePaymentStatus', () => {
    it('should update payment status successfully', async () => {
      const mockPayment = {
        _id: 'payment-id',
        status: 'pending',
        save: jest.fn().mockResolvedValue(true)
      };

      Payment.findById = jest.fn().mockResolvedValue(mockPayment);

      const result = await paymentService.updatePaymentStatus('payment-id', 'completed');

      expect(result.status).toBe('completed');
      expect(mockPayment.save).toHaveBeenCalled();
    });

    it('should throw error for non-existent payment', async () => {
      Payment.findById = jest.fn().mockResolvedValue(null);

      await expect(paymentService.updatePaymentStatus('invalid-id', 'completed'))
        .rejects.toThrow('Payment not found');
    });
  });

  describe('getUserPayments', () => {
    it('should return user payments with pagination', async () => {
      const mockPayments = [
        { _id: 'pay1', userId: 'user-id', amount: 100 },
        { _id: 'pay2', userId: 'user-id', amount: 200 }
      ];

      Payment.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockPayments)
          })
        })
      });

      Payment.countDocuments = jest.fn().mockResolvedValue(2);

      const result = await paymentService.getUserPayments('user-id', { page: 1, limit: 10 });

      expect(result.payments).toEqual(mockPayments);
      expect(result.pagination.total).toBe(2);
    });
  });

  describe('refundPayment', () => {
    it('should process refund successfully', async () => {
      const mockPayment = {
        paymentId: 'payment-id',
        provider: 'stripe',
        providerTransactionId: 'pi_test_payment',
        amount: 100,
        status: 'completed',
        save: jest.fn().mockResolvedValue(true)
      };

      Payment.findOne = jest.fn().mockResolvedValue(mockPayment);

      // Mock provider service
      const mockProviderService = {
        refundPayment: jest.fn().mockResolvedValue({
          refundId: 're_test_refund',
          status: 'succeeded'
        })
      };

      paymentService.providers = { stripe: mockProviderService };

      const result = await paymentService.refundPayment('payment-id', 100, 'Customer request');

      expect(Payment.findOne).toHaveBeenCalledWith({ paymentId: 'payment-id' });
      expect(mockProviderService.refundPayment).toHaveBeenCalledWith('pi_test_payment', 100, 'Customer request');
      expect(mockPayment.save).toHaveBeenCalled();
    });

    it('should throw error for non-refundable payment', async () => {
      const mockPayment = {
        paymentId: 'payment-id',
        status: 'failed'
      };

      Payment.findOne = jest.fn().mockResolvedValue(mockPayment);

      await expect(paymentService.refundPayment('payment-id', 100))
        .rejects.toThrow('Payment cannot be refunded');
    });
  });


  describe('getPaymentStats', () => {
    it('should return payment statistics', async () => {
      const mockStats = [
        {
          _id: { provider: 'stripe', status: 'completed' },
          count: 10,
          totalAmount: 1000
        },
        {
          _id: { provider: 'orange_money', status: 'completed' },
          count: 5,
          totalAmount: 500
        }
      ];

      Payment.aggregate = jest.fn().mockResolvedValue(mockStats);

      const result = await paymentService.getPaymentStats('user-id');

      expect(result).toBeDefined();
      expect(Payment.aggregate).toHaveBeenCalled();
    });
  });
});
