const Payment = require('../models/Payment');
const Provider = require('../models/Provider');
const stripeProvider = require('./providers/stripeProvider');
const orangeMoneyProvider = require('./providers/orangeMoneyProvider');
const afriMoneyProvider = require('./providers/afriMoneyProvider');
const logger = require('../utils/logger');
const axios = require('axios');

class PaymentService {
  constructor() {
    this.providers = {
      stripe: stripeProvider,
      orange_money: orangeMoneyProvider,
      afrimoney: afriMoneyProvider
    };
  }

  async createPayment(paymentData) {
    try {
      // Validate required fields
      if (!paymentData.type) {
        throw new Error('Payment type is required');
      }

      // Validate provider
      const provider = await Provider.findOne({ 
        name: paymentData.provider, 
        isActive: true 
      });
      
      if (!provider) {
        throw new Error(`Provider ${paymentData.provider} not found or inactive`);
      }

      // Validate amount against limits
      const limits = provider?.limits?.[paymentData.type];
      if (!limits) {
        throw new Error('Invalid payment type or provider limits not defined');
      }
      if (paymentData.amount < limits.min || paymentData.amount > limits.max) {
        throw new Error(`Amount must be between ${limits.min} and ${limits.max}`);
      }

      // Calculate fees
      const fees = this.calculateFees(provider, paymentData.amount, paymentData.type);
      
      // Create payment record
      const payment = new Payment({
        ...paymentData,
        fees,
        status: 'pending'
      });

      await payment.save();
      logger.info(`Payment created: ${payment.paymentId}`);
      
      return payment;
    } catch (error) {
      logger.error('Create payment error:', error);
      throw error;
    }
  }

  async processPayment(paymentId, paymentMethodDetails) {
    try {
      const payment = await Payment.findOne({ paymentId });
      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'pending') {
        throw new Error(`Payment cannot be processed. Current status: ${payment.status}`);
      }

      // Update payment status to processing
      payment.status = 'processing';
      await payment.save();

      // Get provider service
      const providerService = this.providers[payment.provider];
      if (!providerService) {
        throw new Error(`Provider service not found: ${payment.provider}`);
      }

      // Process payment with provider
      const result = await providerService.processPayment(payment, paymentMethodDetails);
      
      // Update payment with provider transaction ID
      payment.providerTransactionId = result.transactionId;
      payment.metadata = { ...payment.metadata, ...result.metadata };
      
      if (result.status === 'completed') {
        payment.status = 'completed';
        payment.processedAt = new Date();
        
        // Notify transaction service for balance update
        await this.notifyTransactionService(payment);
      } else if (result.status === 'failed') {
        payment.status = 'failed';
        payment.failureReason = result.failureReason;
      }

      await payment.save();
      logger.info(`Payment processed: ${paymentId}, status: ${payment.status}`);
      
      return payment;
    } catch (error) {
      // Update payment status to failed
      try {
        await Payment.findOneAndUpdate(
          { paymentId },
          { 
            status: 'failed', 
            failureReason: error.message 
          }
        );
      } catch (updateError) {
        logger.error('Failed to update payment status:', updateError);
      }
      
      logger.error('Process payment error:', error);
      throw error;
    }
  }

  async cancelPayment(paymentId, reason) {
    try {
      const payment = await Payment.findOne({ paymentId });
      if (!payment) {
        throw new Error('Payment not found');
      }

      if (!['pending', 'processing'].includes(payment.status)) {
        throw new Error(`Payment cannot be cancelled. Current status: ${payment.status}`);
      }

      // Cancel with provider if processing
      if (payment.status === 'processing' && payment.providerTransactionId) {
        const providerService = this.providers[payment.provider];
        if (providerService && providerService.cancelPayment) {
          await providerService.cancelPayment(payment.providerTransactionId);
        }
      }

      payment.status = 'cancelled';
      payment.failureReason = reason || 'Cancelled by user';
      await payment.save();

      logger.info(`Payment cancelled: ${paymentId}`);
      return payment;
    } catch (error) {
      logger.error('Cancel payment error:', error);
      throw error;
    }
  }

  async refundPayment(paymentId, amount, reason) {
    try {
      const payment = await Payment.findOne({ paymentId });
      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'completed') {
        throw new Error(`Payment cannot be refunded. Current status: ${payment.status}`);
      }

      const refundAmount = amount || payment.amount;
      if (refundAmount > payment.amount) {
        throw new Error('Refund amount cannot exceed payment amount');
      }

      // Process refund with provider
      const providerService = this.providers[payment.provider];
      if (!providerService || !providerService.refundPayment) {
        throw new Error(`Refund not supported for provider: ${payment.provider}`);
      }

      const refundResult = await providerService.refundPayment(
        payment.providerTransactionId,
        refundAmount,
        reason
      );

      // Update payment record
      payment.status = 'refunded';
      payment.refundedAt = new Date();
      payment.metadata = { 
        ...payment.metadata, 
        refund: {
          amount: refundAmount,
          reason,
          refundId: refundResult.refundId,
          refundedAt: new Date()
        }
      };

      await payment.save();

      // Notify transaction service for balance update
      await this.notifyTransactionService(payment, 'refund');

      logger.info(`Payment refunded: ${paymentId}, amount: ${refundAmount}`);
      return payment;
    } catch (error) {
      logger.error('Refund payment error:', error);
      throw error;
    }
  }

  calculateFees(provider, amount, type) {
    const feeConfig = provider.fees[type];
    const fixedFee = feeConfig.fixed || 0;
    const percentageFee = (amount * (feeConfig.percentage || 0)) / 100;
    
    return {
      amount: fixedFee + percentageFee,
      currency: 'USD' // Default currency for fees
    };
  }

  async notifyTransactionService(payment, action = 'payment') {
    try {
      const transactionServiceUrl = process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3003';
      
      const transactionData = {
        fromUserId: action === 'refund' ? null : payment.userId,
        toUserId: action === 'refund' ? null : payment.userId,
        amount: payment.amount,
        currency: 'QMC', // Convert to platform currency
        type: action === 'refund' ? 'withdrawal' : 'deposit',
        description: `${action} via ${payment.provider}`,
        metadata: {
          paymentId: payment.paymentId,
          provider: payment.provider,
          providerTransactionId: payment.providerTransactionId
        }
      };

      await axios.post(`${transactionServiceUrl}/transactions`, transactionData);
      logger.info(`Transaction service notified for payment: ${payment.paymentId}`);
    } catch (error) {
      logger.error('Failed to notify transaction service:', error);
      // Don't throw error as payment was successful
    }
  }

  async getPaymentById(paymentId) {
    try {
      const payment = await Payment.findOne({ paymentId });
      if (!payment) {
        throw new Error('Payment not found');
      }
      return payment;
    } catch (error) {
      logger.error('Get payment error:', error);
      throw error;
    }
  }

  async updatePaymentStatus(paymentId, newStatus) {
    try {
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }
      payment.status = newStatus;
      await payment.save();
      return payment;
    } catch (error) {
      logger.error('Update payment status error:', error);
      throw error;
    }
  }

  async getUserPayments(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        provider,
        type,
        startDate,
        endDate
      } = options;

      const query = { userId };

      if (status) query.status = status;
      if (provider) query.provider = provider;
      if (type) query.type = type;
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const skip = (page - 1) * limit;
      const payments = await Payment.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Payment.countDocuments(query);

      return {
        payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Get user payments error:', error);
      throw error;
    }
  }

  async getPaymentStats(userId, period = '30d') {
    try {
      let startDate = new Date();
      switch (period) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      const stats = await Payment.aggregate([
        {
          $match: {
            userId,
            createdAt: { $gte: startDate },
            status: { $in: ['completed', 'processing'] }
          }
        },
        {
          $group: {
            _id: {
              provider: '$provider',
              type: '$type'
            },
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalFees: { $sum: '$fees.amount' }
          }
        }
      ]);

      return {
        period,
        statistics: stats
      };
    } catch (error) {
      logger.error('Get payment stats error:', error);
      throw error;
    }
  }
}

module.exports = new PaymentService();
