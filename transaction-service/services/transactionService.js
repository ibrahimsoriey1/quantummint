const Transaction = require('../models/Transaction');
const Balance = require('../models/Balance');
const { publishMessage } = require('../config/rabbitmq');
const { getClient: getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const axios = require('axios');

class TransactionService {
  constructor() {
    this.processingQueue = [];
    this.maxRetries = parseInt(process.env.MAX_RETRIES) || 3;
    this.retryDelay = parseInt(process.env.RETRY_DELAY_MS) || 5000;
  }

  // Create a new transaction
  async createTransaction(transactionData) {
    try {
      const {
        userId,
        type,
        amount,
        currency,
        sourceWalletId,
        destinationWalletId,
        destinationAddress,
        description,
        reference,
        metadata = {}
      } = transactionData;

      // Validate transaction data
      await this.validateTransactionData(transactionData);

      // Check user balance and limits
      const balanceCheck = await this.checkTransactionEligibility(userId, amount, currency);
      if (!balanceCheck.allowed) {
        throw new AppError(balanceCheck.reason, 400, 'TRANSACTION_ELIGIBILITY_FAILED');
      }

      // Calculate fees
      const fees = await this.calculateTransactionFees(amount, currency, type);

      // Create transaction record
      const transaction = new Transaction({
        type,
        userId,
        sourceWalletId,
        destinationWalletId,
        destinationAddress,
        amount,
        currency,
        feeAmount: fees.amount,
        feeCurrency: fees.currency,
        feePercentage: fees.percentage,
        netAmount: amount - fees.amount,
        description,
        reference,
        metadata: {
          ...metadata,
          source: 'transaction-service',
          createdAt: new Date().toISOString()
        }
      });

      // Save transaction
      await transaction.save();

      // Lock the amount in user's balance
      await this.lockTransactionAmount(userId, amount, currency);

      // Publish transaction created event
      await this.publishTransactionEvent('created', transaction);

      logger.transaction('Transaction created successfully', {
        transactionId: transaction.transactionId,
        userId,
        type,
        amount,
        currency
      });

      return transaction;
    } catch (error) {
      logger.error('Error creating transaction:', error);
      throw error;
    }
  }

  // Process a transaction
  async processTransaction(transactionId, options = {}) {
    try {
      const transaction = await Transaction.findOne({ transactionId });
      if (!transaction) {
        throw new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
      }

      if (transaction.status !== 'pending') {
        throw new AppError('Transaction is not in pending status', 400, 'INVALID_TRANSACTION_STATUS');
      }

      // Update status to processing
      transaction.status = 'processing';
      transaction.processedAt = new Date();
      await transaction.save();

      // Perform compliance checks
      const complianceResult = await this.performComplianceChecks(transaction);
      if (!complianceResult.approved) {
        transaction.status = 'failed';
        transaction.errorCode = 'COMPLIANCE_FAILED';
        transaction.errorMessage = complianceResult.reason;
        await transaction.save();
        
        // Unlock the amount
        await this.unlockTransactionAmount(transaction.userId, transaction.amount, transaction.currency);
        
        throw new AppError(`Compliance check failed: ${complianceResult.reason}`, 403, 'COMPLIANCE_CHECK_FAILED');
      }

      // Process based on transaction type
      let result;
      switch (transaction.type) {
        case 'transfer':
          result = await this.processTransfer(transaction);
          break;
        case 'withdrawal':
          result = await this.processWithdrawal(transaction);
          break;
        case 'deposit':
          result = await this.processDeposit(transaction);
          break;
        case 'generation':
          result = await this.processGeneration(transaction);
          break;
        default:
          throw new AppError(`Unsupported transaction type: ${transaction.type}`, 400, 'UNSUPPORTED_TRANSACTION_TYPE');
      }

      // Update transaction with result
      transaction.status = 'completed';
      transaction.completedAt = new Date();
      transaction.processingTime = transaction.completedAt - transaction.processedAt;
      transaction.metadata = {
        ...transaction.metadata,
        result,
        processedAt: transaction.processedAt.toISOString(),
        completedAt: transaction.completedAt.toISOString()
      };

      await transaction.save();

      // Update balances
      await this.updateBalancesAfterTransaction(transaction);

      // Publish transaction completed event
      await this.publishTransactionEvent('completed', transaction);

      logger.transaction('Transaction processed successfully', {
        transactionId: transaction.transactionId,
        userId: transaction.userId,
        type: transaction.type,
        processingTime: transaction.processingTime
      });

      return transaction;
    } catch (error) {
      logger.error('Error processing transaction:', error);
      
      // Update transaction status to failed
      if (transaction) {
        transaction.status = 'failed';
        transaction.errorCode = error.errorCode || 'PROCESSING_ERROR';
        transaction.errorMessage = error.message;
        await transaction.save();
        
        // Unlock the amount
        await this.unlockTransactionAmount(transaction.userId, transaction.amount, transaction.currency);
      }
      
      throw error;
    }
  }

  // Validate transaction data
  async validateTransactionData(data) {
    const { amount, currency, type, userId } = data;

    // Check minimum and maximum amounts
    const minAmount = parseFloat(process.env.MIN_TRANSACTION_AMOUNT) || 1.00;
    const maxAmount = parseFloat(process.env.MAX_TRANSACTION_AMOUNT) || 1000000.00;

    if (amount < minAmount) {
      throw new AppError(`Amount must be at least ${minAmount} ${currency}`, 400, 'AMOUNT_BELOW_MINIMUM');
    }

    if (amount > maxAmount) {
      throw new AppError(`Amount cannot exceed ${maxAmount} ${currency}`, 400, 'AMOUNT_ABOVE_MAXIMUM');
    }

    // Validate currency
    const supportedCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];
    if (!supportedCurrencies.includes(currency.toUpperCase())) {
      throw new AppError(`Unsupported currency: ${currency}`, 400, 'UNSUPPORTED_CURRENCY');
    }

    // Check if user exists and is verified
    try {
      const authResponse = await axios.get(`${process.env.AUTH_SERVICE_URL}/api/v1/users/${userId}`, {
        headers: { 'Authorization': `Bearer ${process.env.SERVICE_API_KEY}` }
      });
      
      if (!authResponse.data.isVerified) {
        throw new AppError('User account not verified', 403, 'ACCOUNT_UNVERIFIED');
      }
    } catch (error) {
      if (error.response?.status === 404) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
      throw new AppError('Failed to verify user', 500, 'USER_VERIFICATION_FAILED');
    }
  }

  // Check transaction eligibility
  async checkTransactionEligibility(userId, amount, currency) {
    try {
      const balance = await Balance.getUserBalance(userId);
      
      // Check if balance is active
      if (balance.status !== 'active') {
        return { allowed: false, reason: 'Account is not active' };
      }

      // Check transaction limits
      const limitCheck = balance.canTransact(currency, amount);
      if (!limitCheck.allowed) {
        return limitCheck;
      }

      // Check available balance
      const userBalance = balance.getBalance(currency);
      if (userBalance.available < amount) {
        return { allowed: false, reason: 'Insufficient available balance' };
      }

      return { allowed: true };
    } catch (error) {
      logger.error('Error checking transaction eligibility:', error);
      return { allowed: false, reason: 'Failed to check eligibility' };
    }
  }

  // Calculate transaction fees
  async calculateTransactionFees(amount, currency, type) {
    const baseFeePercentage = parseFloat(process.env.TRANSACTION_FEE_PERCENTAGE) || 2.5;
    let feePercentage = baseFeePercentage;

    // Adjust fees based on transaction type
    switch (type) {
      case 'transfer':
        feePercentage = baseFeePercentage * 0.5; // Lower fees for transfers
        break;
      case 'withdrawal':
        feePercentage = baseFeePercentage * 1.5; // Higher fees for withdrawals
        break;
      case 'deposit':
        feePercentage = 0; // No fees for deposits
        break;
      case 'generation':
        feePercentage = baseFeePercentage * 0.8; // Lower fees for generated money
        break;
    }

    const feeAmount = (amount * feePercentage) / 100;

    return {
      amount: feeAmount,
      currency,
      percentage: feePercentage
    };
  }

  // Lock transaction amount
  async lockTransactionAmount(userId, amount, currency) {
    try {
      const balance = await Balance.getUserBalance(userId);
      balance.lockBalance(currency, amount);
      await balance.save();

      logger.balance('Transaction amount locked', {
        userId,
        amount,
        currency,
        availableBalance: balance.getBalance(currency).available
      });
    } catch (error) {
      logger.error('Error locking transaction amount:', error);
      throw error;
    }
  }

  // Unlock transaction amount
  async unlockTransactionAmount(userId, amount, currency) {
    try {
      const balance = await Balance.getUserBalance(userId);
      balance.unlockBalance(currency, amount);
      await balance.save();

      logger.balance('Transaction amount unlocked', {
        userId,
        amount,
        currency,
        availableBalance: balance.getBalance(currency).available
      });
    } catch (error) {
      logger.error('Error unlocking transaction amount:', error);
      throw error;
    }
  }

  // Perform compliance checks
  async performComplianceChecks(transaction) {
    try {
      // Check KYC level requirements
      if (transaction.amount > 10000) {
        const authResponse = await axios.get(`${process.env.AUTH_SERVICE_URL}/api/v1/users/${transaction.userId}`, {
          headers: { 'Authorization': `Bearer ${process.env.SERVICE_API_KEY}` }
        });
        
        if (authResponse.data.kycLevel !== 'enhanced') {
          return {
            approved: false,
            reason: 'Enhanced KYC required for transactions above $10,000'
          };
        }
      }

      // Check for suspicious patterns
      const suspiciousPatterns = await this.detectSuspiciousPatterns(transaction);
      if (suspiciousPatterns.length > 0) {
        return {
          approved: false,
          reason: `Suspicious activity detected: ${suspiciousPatterns.join(', ')}`
        };
      }

      // Check sanctions and PEP lists
      const sanctionsCheck = await this.checkSanctionsAndPEP(transaction);
      if (!sanctionsCheck.approved) {
        return sanctionsCheck;
      }

      return { approved: true };
    } catch (error) {
      logger.error('Error performing compliance checks:', error);
      return {
        approved: false,
        reason: 'Compliance check failed due to system error'
      };
    }
  }

  // Detect suspicious patterns
  async detectSuspiciousPatterns(transaction) {
    const patterns = [];
    
    try {
      // Check for unusual transaction amounts
      const userStats = await Transaction.getTransactionStats(transaction.userId, 'month');
      const avgAmount = userStats.reduce((sum, stat) => sum + stat.avgAmount, 0) / userStats.length;
      
      if (transaction.amount > avgAmount * 10) {
        patterns.push('Unusually high amount');
      }

      // Check for rapid successive transactions
      const recentTransactions = await Transaction.find({
        userId: transaction.userId,
        createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
      });

      if (recentTransactions.length > 5) {
        patterns.push('Rapid successive transactions');
      }

      // Check for round amounts (potential money laundering indicator)
      if (transaction.amount % 1000 === 0 && transaction.amount > 10000) {
        patterns.push('Suspicious round amount');
      }

    } catch (error) {
      logger.error('Error detecting suspicious patterns:', error);
    }

    return patterns;
  }

  // Check sanctions and PEP lists
  async checkSanctionsAndPEP(transaction) {
    try {
      // This would integrate with external sanctions checking services
      // For now, we'll return a basic check
      
      // Check if user is in any known sanctions lists
      const sanctionsCheck = await this.checkUserSanctions(transaction.userId);
      if (sanctionsCheck.isSanctioned) {
        return {
          approved: false,
          reason: `User is on sanctions list: ${sanctionsCheck.list}`
        };
      }

      // Check if user is a Politically Exposed Person (PEP)
      const pepCheck = await this.checkUserPEP(transaction.userId);
      if (pepCheck.isPEP) {
        // PEP transactions require additional scrutiny but are not automatically rejected
        transaction.flags = transaction.flags || [];
        transaction.flags.push('pep');
        await transaction.save();
      }

      return { approved: true };
    } catch (error) {
      logger.error('Error checking sanctions and PEP:', error);
      return {
        approved: false,
        reason: 'Sanctions check failed due to system error'
      };
    }
  }

  // Process different transaction types
  async processTransfer(transaction) {
    // For transfers, we need to update both source and destination balances
    const sourceBalance = await Balance.getUserBalance(transaction.userId);
    const destinationBalance = await Balance.getUserBalance(transaction.destinationWalletId);

    // Deduct from source (already locked)
    sourceBalance.updateBalance(transaction.currency, transaction.amount, 'locked', 'debit');
    
    // Add to destination
    destinationBalance.updateBalance(transaction.currency, transaction.amount, 'available', 'credit');

    await Promise.all([sourceBalance.save(), destinationBalance.save()]);

    return { type: 'transfer', status: 'completed' };
  }

  async processWithdrawal(transaction) {
    // For withdrawals, we need to integrate with payment services
    // This is a placeholder - actual implementation would call payment service APIs
    
    // Simulate external payment processing
    const paymentResult = await this.processExternalPayment(transaction);
    
    if (paymentResult.success) {
      // Deduct from locked balance
      const balance = await Balance.getUserBalance(transaction.userId);
      balance.updateBalance(transaction.currency, transaction.amount, 'locked', 'debit');
      await balance.save();
      
      return { type: 'withdrawal', status: 'completed', paymentId: paymentResult.paymentId };
    } else {
      throw new AppError('Payment processing failed', 400, 'PAYMENT_PROCESSING_FAILED');
    }
  }

  async processDeposit(transaction) {
    // For deposits, we need to add to user's balance
    const balance = await Balance.getUserBalance(transaction.userId);
    balance.updateBalance(transaction.currency, transaction.amount, 'available', 'credit');
    await balance.save();

    return { type: 'deposit', status: 'completed' };
  }

  async processGeneration(transaction) {
    // For money generation, we need to add to user's balance
    const balance = await Balance.getUserBalance(transaction.userId);
    balance.updateBalance(transaction.currency, transaction.amount, 'available', 'credit');
    await balance.save();

    return { type: 'generation', status: 'completed' };
  }

  // Update balances after transaction
  async updateBalancesAfterTransaction(transaction) {
    try {
      const balance = await Balance.getUserBalance(transaction.userId);
      
      // Update transaction metrics
      balance.metrics.totalTransactions += 1;
      balance.metrics.lastTransactionAt = new Date();
      
      // Update volume metrics
      const currentVolume = balance.metrics.totalVolume.get(transaction.currency) || 0;
      balance.metrics.totalVolume.set(transaction.currency, currentVolume + transaction.amount);
      
      // Update average transaction size
      const currentAvg = balance.metrics.averageTransactionSize.get(transaction.currency) || 0;
      const newAvg = ((currentAvg * (balance.metrics.totalTransactions - 1)) + transaction.amount) / balance.metrics.totalTransactions;
      balance.metrics.averageTransactionSize.set(transaction.currency, newAvg);

      await balance.save();

      logger.balance('Balance updated after transaction', {
        userId: transaction.userId,
        transactionId: transaction.transactionId,
        newBalance: balance.getBalance(transaction.currency)
      });
    } catch (error) {
      logger.error('Error updating balance after transaction:', error);
      throw error;
    }
  }

  // Publish transaction events
  async publishTransactionEvent(event, transaction) {
    try {
      const message = {
        event,
        transactionId: transaction.transactionId,
        userId: transaction.userId,
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        timestamp: new Date().toISOString()
      };

      await publishMessage('transactions', event, message);
      
      logger.transaction(`Transaction event published: ${event}`, {
        transactionId: transaction.transactionId,
        event
      });
    } catch (error) {
      logger.error('Error publishing transaction event:', error);
      // Don't throw error as this is not critical for transaction processing
    }
  }

  // Process external payment (placeholder)
  async processExternalPayment(transaction) {
    // This would integrate with actual payment services
    // For now, we'll simulate a successful payment
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      success: true,
      paymentId: `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'completed'
    };
  }

  // Check user sanctions (placeholder)
  async checkUserSanctions(userId) {
    // This would integrate with external sanctions checking services
    return { isSanctioned: false, list: null };
  }

  // Check user PEP status (placeholder)
  async checkUserPEP(userId) {
    // This would integrate with external PEP checking services
    return { isPEP: false, riskLevel: 'low' };
  }

  // Get transaction by ID
  async getTransaction(transactionId) {
    const transaction = await Transaction.findOne({ transactionId });
    if (!transaction) {
      throw new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
    }
    return transaction;
  }

  // Get user transactions
  async getUserTransactions(userId, options = {}) {
    return await Transaction.getUserTransactions(userId, options);
  }

  // Cancel transaction
  async cancelTransaction(transactionId, userId) {
    const transaction = await Transaction.findOne({ transactionId, userId });
    if (!transaction) {
      throw new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
    }

    if (transaction.status !== 'pending') {
      throw new AppError('Only pending transactions can be cancelled', 400, 'INVALID_CANCELLATION_STATUS');
    }

    transaction.status = 'cancelled';
    await transaction.save();

    // Unlock the amount
    await this.unlockTransactionAmount(userId, transaction.amount, transaction.currency);

    // Publish cancellation event
    await this.publishTransactionEvent('cancelled', transaction);

    return transaction;
  }

  // Retry failed transaction
  async retryTransaction(transactionId, userId) {
    const transaction = await Transaction.findOne({ transactionId, userId });
    if (!transaction) {
      throw new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
    }

    if (transaction.status !== 'failed') {
      throw new AppError('Only failed transactions can be retried', 400, 'INVALID_RETRY_STATUS');
    }

    if (!transaction.canRetry()) {
      throw new AppError('Maximum retry attempts reached', 400, 'MAX_RETRIES_EXCEEDED');
    }

    // Reset transaction for retry
    transaction.status = 'pending';
    transaction.retryCount += 1;
    transaction.errorCode = null;
    transaction.errorMessage = null;
    transaction.processedAt = null;
    transaction.completedAt = null;
    transaction.processingTime = null;

    await transaction.save();

    // Process the transaction again
    return await this.processTransaction(transactionId);
  }
}

module.exports = new TransactionService();
