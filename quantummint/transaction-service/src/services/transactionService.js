const Transaction = require('../models/Transaction');
const Balance = require('../models/Balance');
const balanceService = require('./balanceService');
const logger = require('../utils/logger');
const Decimal = require('decimal.js');

class TransactionService {
  async createTransaction(transactionData) {
    const session = await Transaction.startSession();
    session.startTransaction();

    try {
      // Validate transaction data
      await this.validateTransaction(transactionData);

      // Check if sender has sufficient balance (for transfers, withdrawals, and debits)
      if (['transfer', 'withdrawal', 'debit'].includes(transactionData.type)) {
        const senderBalance = await balanceService.getUserBalance(transactionData.fromUserId);
        const availableBalance = senderBalance.balances.find(b => b.currency === 'QMC')?.available || 0;
        
        if (new Decimal(availableBalance).lessThan(transactionData.amount)) {
          throw new Error('Insufficient funds');
        }

        // Lock funds for the transaction
        await balanceService.lockFunds(
          transactionData.fromUserId,
          transactionData.amount,
          'QMC',
          `Transaction ${transactionData.transactionId}`
        );
      }

      // Create the transaction
      const transaction = new Transaction(transactionData);
      await transaction.save({ session });

      // For certain transaction types, process immediately
      if (['generation', 'deposit'].includes(transactionData.type)) {
        transaction.status = 'completed';
        transaction.processedAt = new Date();
        await transaction.save({ session });

        // Update balances
        await this.updateBalancesForTransaction(transaction, session);
      }

      await session.commitTransaction();
      logger.info(`Transaction created: ${transaction.transactionId}`);
      
      return transaction;
    } catch (error) {
      await session.abortTransaction();
      logger.error('Transaction creation failed:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async updateBalancesForTransaction(transaction, session = null) {
    try {
      const { fromUserId, toUserId, amount, type, currency = 'QMC' } = transaction;

      switch (type) {
        case 'transfer':
          // Deduct from sender (unlock locked funds and deduct)
          await balanceService.unlockFunds(fromUserId, amount, currency, `Transfer ${transaction.transactionId}`);
          await balanceService.deductFunds(fromUserId, amount, currency, transaction.transactionId);
          
          // Add to receiver
          await balanceService.addFunds(toUserId, amount, currency, transaction.transactionId);
          break;

        case 'deposit':
        case 'generation':
          // Add to user balance
          await balanceService.addFunds(toUserId, amount, currency, transaction.transactionId);
          break;

        case 'withdrawal':
          // Deduct from user balance (unlock locked funds and deduct)
          await balanceService.unlockFunds(fromUserId, amount, currency, `Withdrawal ${transaction.transactionId}`);
          await balanceService.deductFunds(fromUserId, amount, currency, transaction.transactionId);
          break;

        case 'fee':
          // Deduct fee from user balance
          await balanceService.deductFunds(fromUserId, amount, currency, transaction.transactionId);
          break;

        default:
          logger.warn(`Unknown transaction type: ${type}`);
      }

      logger.info(`Balances updated for transaction: ${transaction.transactionId}`);
    } catch (error) {
      logger.error('Balance update failed:', error);
      throw error;
    }
  }

  async validateTransaction(transactionData) {
    const { fromUserId, toUserId, amount, type } = transactionData;

    // Validate amount
    if (!amount || amount <= 0) {
      throw new Error('Invalid transaction amount');
    }

    // Validate user IDs based on transaction type
    if (['transfer'].includes(type)) {
      if (!fromUserId || !toUserId) {
        throw new Error('Both fromUserId and toUserId are required for transfers');
      }
      if (fromUserId === toUserId) {
        throw new Error('Cannot transfer to the same user');
      }
    }

    if (['deposit', 'generation'].includes(type) && !toUserId) {
      throw new Error('toUserId is required for deposits and generations');
    }

    if (['withdrawal'].includes(type) && !fromUserId) {
      throw new Error('fromUserId is required for withdrawals');
    }

    return true;
  }

  async getTransactionById(transactionId) {
    try {
      const transaction = await Transaction.findOne({ transactionId });
      if (!transaction) {
        throw new Error('Transaction not found');
      }
      return transaction;
    } catch (error) {
      logger.error('Get transaction error:', error);
      throw error;
    }
  }

  async getUserTransactions(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        type,
        startDate,
        endDate
      } = options;

      const query = {
        $or: [
          { fromUserId: userId },
          { toUserId: userId }
        ]
      };

      if (status) query.status = status;
      if (type) query.type = type;
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const skip = (page - 1) * limit;
      const transactions = await Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Transaction.countDocuments(query);

      return {
        transactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Get user transactions error:', error);
      throw error;
    }
  }

  async updateTransactionStatus(transactionId, status, failureReason = null) {
    try {
      const validStatuses = ['pending', 'completed', 'failed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        throw new Error('Invalid status');
      }

      const updateData = { status };
      if (status === 'completed') {
        updateData.processedAt = new Date();
      }
      if (status === 'failed' && failureReason) {
        updateData.failureReason = failureReason;
      }

      const transaction = await Transaction.findOneAndUpdate(
        { transactionId },
        updateData,
        { new: true }
      );

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Update balances if transaction is completed
      if (status === 'completed') {
        await this.updateBalancesForTransaction(transaction);
      }

      // If transaction failed or cancelled, unlock any locked funds
      if (['failed', 'cancelled'].includes(status) && ['transfer', 'withdrawal'].includes(transaction.type)) {
        await balanceService.unlockFunds(
          transaction.fromUserId,
          transaction.amount,
          transaction.currency || 'QMC',
          `${status} transaction ${transactionId}`
        );
      }

      logger.info(`Transaction ${transactionId} status updated to ${status}`);
      return transaction;
    } catch (error) {
      logger.error('Update transaction status error:', error);
      throw error;
    }
  }

  async getTransactionStats(userId, period = '30d') {
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

      const stats = await Transaction.aggregate([
        {
          $match: {
            $or: [{ fromUserId: userId }, { toUserId: userId }],
            createdAt: { $gte: startDate },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      return {
        period,
        statistics: stats
      };
    } catch (error) {
      logger.error('Get transaction stats error:', error);
      throw error;
    }
  }

  validateTransactionData(transactionData) {
    if (!transactionData.type || !['credit', 'debit', 'transfer', 'withdrawal'].includes(transactionData.type)) {
      throw new Error('Invalid transaction type');
    }
    
    if (!transactionData.amount || transactionData.amount <= 0) {
      throw new Error('Amount must be positive');
    }
    
    if (!transactionData.userId) {
      throw new Error('User ID is required');
    }
    
    return true;
  }

  async getTransactionsByUser(userId, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      
      const transactions = await Transaction.find({
        $or: [{ fromUserId: userId }, { toUserId: userId }]
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Transaction.countDocuments({
        $or: [{ fromUserId: userId }, { toUserId: userId }]
      });

      return {
        transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Get transactions by user error:', error);
      throw error;
    }
  }
}

module.exports = new TransactionService();
