const { v4: uuidv4 } = require('uuid');
const Transaction = require('../models/transaction.model');
const Balance = require('../models/balance.model');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const { publishMessage } = require('../config/messageQueue');

/**
 * Create a new transaction
 * @param {Object} data - Transaction data
 * @returns {Promise<Object>} - Created transaction
 */
const createTransaction = async (data) => {
  try {
    const { 
      userId, 
      type, 
      amount, 
      fee = 0, 
      description, 
      reference,
      method,
      provider,
      recipientId,
      recipientInfo,
      metadata,
      ipAddress,
      userAgent
    } = data;
    
    // Validate amount
    if (!amount || amount <= 0) {
      throw new ApiError(400, 'Invalid amount');
    }
    
    // Calculate net amount
    const netAmount = amount - fee;
    
    if (netAmount < 0) {
      throw new ApiError(400, 'Fee cannot exceed amount');
    }
    
    // Create transaction
    const transaction = new Transaction({
      userId,
      type,
      amount,
      fee,
      netAmount,
      description,
      reference: reference || uuidv4(),
      method,
      provider,
      recipientId,
      recipientInfo,
      metadata,
      ipAddress,
      userAgent,
      status: 'pending'
    });
    
    await transaction.save();
    
    // Process transaction based on type
    switch (type) {
      case 'generation':
        await processGenerationTransaction(transaction);
        break;
      case 'transfer':
        await processTransferTransaction(transaction);
        break;
      case 'payment':
        await processPaymentTransaction(transaction);
        break;
      case 'withdrawal':
        await processWithdrawalTransaction(transaction);
        break;
      case 'refund':
        await processRefundTransaction(transaction);
        break;
      case 'bonus':
        await processBonusTransaction(transaction);
        break;
      case 'adjustment':
        await processAdjustmentTransaction(transaction);
        break;
      default:
        // For other types, just mark as completed
        transaction.status = 'completed';
        await transaction.save();
    }
    
    // Publish transaction created message
    await publishMessage('transaction.created', {
      transactionId: transaction._id,
      userId: transaction.userId,
      type: transaction.type,
      amount: transaction.amount,
      status: transaction.status
    });
    
    return transaction;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Transaction creation error: ${error.message}`);
    throw new ApiError(500, 'Failed to create transaction');
  }
};

/**
 * Process generation transaction
 * @param {Object} transaction - Transaction object
 */
const processGenerationTransaction = async (transaction) => {
  try {
    // Get or create balance
    let balance = await Balance.findOne({ userId: transaction.userId });
    
    if (!balance) {
      balance = new Balance({ userId: transaction.userId });
    }
    
    // Check if balance is active
    if (balance.status !== 'active') {
      transaction.status = 'failed';
      transaction.metadata.failureReason = 'Balance is not active';
      await transaction.save();
      throw new ApiError(403, 'Balance is not active');
    }
    
    // Add funds to balance
    balance.addFunds(transaction.netAmount, transaction._id);
    await balance.save();
    
    // Update transaction status
    transaction.status = 'completed';
    await transaction.save();
    
    return transaction;
  } catch (error) {
    logger.error(`Process generation transaction error: ${error.message}`);
    
    // Update transaction status if not already updated
    if (transaction.status !== 'failed') {
      transaction.status = 'failed';
      transaction.metadata.failureReason = error.message;
      await transaction.save();
    }
    
    throw error;
  }
};

/**
 * Process transfer transaction
 * @param {Object} transaction - Transaction object
 */
const processTransferTransaction = async (transaction) => {
  try {
    // Validate recipient
    if (!transaction.recipientId) {
      transaction.status = 'failed';
      transaction.metadata.failureReason = 'Recipient ID is required';
      await transaction.save();
      throw new ApiError(400, 'Recipient ID is required');
    }
    
    // Get sender balance
    let senderBalance = await Balance.findOne({ userId: transaction.userId });
    
    if (!senderBalance) {
      senderBalance = new Balance({ userId: transaction.userId });
      await senderBalance.save();
    }
    
    // Check if sender balance is active
    if (senderBalance.status !== 'active') {
      transaction.status = 'failed';
      transaction.metadata.failureReason = 'Sender balance is not active';
      await transaction.save();
      throw new ApiError(403, 'Sender balance is not active');
    }
    
    // Check if sender has sufficient funds
    if (senderBalance.available < transaction.amount) {
      transaction.status = 'failed';
      transaction.metadata.failureReason = 'Insufficient funds';
      await transaction.save();
      throw new ApiError(400, 'Insufficient funds');
    }
    
    // Get or create recipient balance
    let recipientBalance = await Balance.findOne({ userId: transaction.recipientId });
    
    if (!recipientBalance) {
      recipientBalance = new Balance({ userId: transaction.recipientId });
    }
    
    // Check if recipient balance is active
    if (recipientBalance.status !== 'active') {
      transaction.status = 'failed';
      transaction.metadata.failureReason = 'Recipient balance is not active';
      await transaction.save();
      throw new ApiError(403, 'Recipient balance is not active');
    }
    
    // Deduct funds from sender
    senderBalance.deductFunds(transaction.amount, transaction._id);
    await senderBalance.save();
    
    // Add funds to recipient
    recipientBalance.addFunds(transaction.netAmount, transaction._id);
    await recipientBalance.save();
    
    // Update transaction status
    transaction.status = 'completed';
    await transaction.save();
    
    // Create recipient transaction record
    const recipientTransaction = new Transaction({
      userId: transaction.recipientId,
      type: 'transfer',
      amount: transaction.netAmount,
      fee: 0,
      netAmount: transaction.netAmount,
      description: `Transfer from ${transaction.userId}`,
      reference: transaction.reference,
      metadata: {
        senderUserId: transaction.userId,
        originalTransactionId: transaction._id
      },
      status: 'completed'
    });
    
    await recipientTransaction.save();
    
    // Publish transfer completed message
    await publishMessage('transaction.transfer_completed', {
      transactionId: transaction._id,
      senderUserId: transaction.userId,
      recipientUserId: transaction.recipientId,
      amount: transaction.amount,
      netAmount: transaction.netAmount,
      fee: transaction.fee
    });
    
    return transaction;
  } catch (error) {
    logger.error(`Process transfer transaction error: ${error.message}`);
    
    // Update transaction status if not already updated
    if (transaction.status !== 'failed') {
      transaction.status = 'failed';
      transaction.metadata.failureReason = error.message;
      await transaction.save();
    }
    
    throw error;
  }
};

/**
 * Process payment transaction
 * @param {Object} transaction - Transaction object
 */
const processPaymentTransaction = async (transaction) => {
  try {
    // Get balance
    let balance = await Balance.findOne({ userId: transaction.userId });
    
    if (!balance) {
      balance = new Balance({ userId: transaction.userId });
      await balance.save();
    }
    
    // Check if balance is active
    if (balance.status !== 'active') {
      transaction.status = 'failed';
      transaction.metadata.failureReason = 'Balance is not active';
      await transaction.save();
      throw new ApiError(403, 'Balance is not active');
    }
    
    // Check if user has sufficient funds
    if (balance.available < transaction.amount) {
      transaction.status = 'failed';
      transaction.metadata.failureReason = 'Insufficient funds';
      await transaction.save();
      throw new ApiError(400, 'Insufficient funds');
    }
    
    // Reserve funds
    balance.reserveFunds(transaction.amount, transaction._id);
    await balance.save();
    
    // Update transaction status to pending (will be completed by payment service)
    transaction.status = 'pending';
    await transaction.save();
    
    // Publish payment initiated message
    await publishMessage('transaction.payment_initiated', {
      transactionId: transaction._id,
      userId: transaction.userId,
      amount: transaction.amount,
      provider: transaction.provider,
      recipientInfo: transaction.recipientInfo
    });
    
    return transaction;
  } catch (error) {
    logger.error(`Process payment transaction error: ${error.message}`);
    
    // Update transaction status if not already updated
    if (transaction.status !== 'failed') {
      transaction.status = 'failed';
      transaction.metadata.failureReason = error.message;
      await transaction.save();
    }
    
    throw error;
  }
};

/**
 * Process withdrawal transaction
 * @param {Object} transaction - Transaction object
 */
const processWithdrawalTransaction = async (transaction) => {
  try {
    // Get balance
    let balance = await Balance.findOne({ userId: transaction.userId });
    
    if (!balance) {
      balance = new Balance({ userId: transaction.userId });
      await balance.save();
    }
    
    // Check if balance is active
    if (balance.status !== 'active') {
      transaction.status = 'failed';
      transaction.metadata.failureReason = 'Balance is not active';
      await transaction.save();
      throw new ApiError(403, 'Balance is not active');
    }
    
    // Check if user has sufficient funds
    if (balance.available < transaction.amount) {
      transaction.status = 'failed';
      transaction.metadata.failureReason = 'Insufficient funds';
      await transaction.save();
      throw new ApiError(400, 'Insufficient funds');
    }
    
    // Reserve funds
    balance.reserveFunds(transaction.amount, transaction._id);
    await balance.save();
    
    // Update transaction status to pending (will be completed by payment service)
    transaction.status = 'pending';
    await transaction.save();
    
    // Publish withdrawal initiated message
    await publishMessage('transaction.withdrawal_initiated', {
      transactionId: transaction._id,
      userId: transaction.userId,
      amount: transaction.amount,
      provider: transaction.provider,
      recipientInfo: transaction.recipientInfo
    });
    
    return transaction;
  } catch (error) {
    logger.error(`Process withdrawal transaction error: ${error.message}`);
    
    // Update transaction status if not already updated
    if (transaction.status !== 'failed') {
      transaction.status = 'failed';
      transaction.metadata.failureReason = error.message;
      await transaction.save();
    }
    
    throw error;
  }
};

/**
 * Process refund transaction
 * @param {Object} transaction - Transaction object
 */
const processRefundTransaction = async (transaction) => {
  try {
    // Validate reference
    if (!transaction.reference) {
      transaction.status = 'failed';
      transaction.metadata.failureReason = 'Original transaction reference is required';
      await transaction.save();
      throw new ApiError(400, 'Original transaction reference is required');
    }
    
    // Find original transaction
    const originalTransaction = await Transaction.findOne({ reference: transaction.reference, userId: transaction.userId });
    
    if (!originalTransaction) {
      transaction.status = 'failed';
      transaction.metadata.failureReason = 'Original transaction not found';
      await transaction.save();
      throw new ApiError(404, 'Original transaction not found');
    }
    
    // Check if original transaction is completed
    if (originalTransaction.status !== 'completed') {
      transaction.status = 'failed';
      transaction.metadata.failureReason = 'Original transaction is not completed';
      await transaction.save();
      throw new ApiError(400, 'Original transaction is not completed');
    }
    
    // Check if refund amount is valid
    if (transaction.amount > originalTransaction.amount) {
      transaction.status = 'failed';
      transaction.metadata.failureReason = 'Refund amount cannot exceed original amount';
      await transaction.save();
      throw new ApiError(400, 'Refund amount cannot exceed original amount');
    }
    
    // Get balance
    let balance = await Balance.findOne({ userId: transaction.userId });
    
    if (!balance) {
      balance = new Balance({ userId: transaction.userId });
      await balance.save();
    }
    
    // Add funds to balance
    balance.addFunds(transaction.netAmount, transaction._id);
    await balance.save();
    
    // Update transaction status
    transaction.status = 'completed';
    await transaction.save();
    
    // Publish refund completed message
    await publishMessage('transaction.refund_completed', {
      transactionId: transaction._id,
      userId: transaction.userId,
      amount: transaction.amount,
      originalTransactionId: originalTransaction._id
    });
    
    return transaction;
  } catch (error) {
    logger.error(`Process refund transaction error: ${error.message}`);
    
    // Update transaction status if not already updated
    if (transaction.status !== 'failed') {
      transaction.status = 'failed';
      transaction.metadata.failureReason = error.message;
      await transaction.save();
    }
    
    throw error;
  }
};

/**
 * Process bonus transaction
 * @param {Object} transaction - Transaction object
 */
const processBonusTransaction = async (transaction) => {
  try {
    // Get or create balance
    let balance = await Balance.findOne({ userId: transaction.userId });
    
    if (!balance) {
      balance = new Balance({ userId: transaction.userId });
    }
    
    // Check if balance is active
    if (balance.status !== 'active') {
      transaction.status = 'failed';
      transaction.metadata.failureReason = 'Balance is not active';
      await transaction.save();
      throw new ApiError(403, 'Balance is not active');
    }
    
    // Add funds to balance
    balance.addFunds(transaction.netAmount, transaction._id);
    await balance.save();
    
    // Update transaction status
    transaction.status = 'completed';
    await transaction.save();
    
    // Publish bonus completed message
    await publishMessage('transaction.bonus_completed', {
      transactionId: transaction._id,
      userId: transaction.userId,
      amount: transaction.amount
    });
    
    return transaction;
  } catch (error) {
    logger.error(`Process bonus transaction error: ${error.message}`);
    
    // Update transaction status if not already updated
    if (transaction.status !== 'failed') {
      transaction.status = 'failed';
      transaction.metadata.failureReason = error.message;
      await transaction.save();
    }
    
    throw error;
  }
};

/**
 * Process adjustment transaction
 * @param {Object} transaction - Transaction object
 */
const processAdjustmentTransaction = async (transaction) => {
  try {
    // Get or create balance
    let balance = await Balance.findOne({ userId: transaction.userId });
    
    if (!balance) {
      balance = new Balance({ userId: transaction.userId });
    }
    
    // Check if balance is active
    if (balance.status !== 'active') {
      transaction.status = 'failed';
      transaction.metadata.failureReason = 'Balance is not active';
      await transaction.save();
      throw new ApiError(403, 'Balance is not active');
    }
    
    // Check if adjustment is positive or negative
    if (transaction.amount > 0) {
      // Positive adjustment (add funds)
      balance.addFunds(transaction.netAmount, transaction._id);
    } else {
      // Negative adjustment (deduct funds)
      const deductAmount = Math.abs(transaction.amount);
      
      // Check if user has sufficient funds
      if (balance.available < deductAmount) {
        transaction.status = 'failed';
        transaction.metadata.failureReason = 'Insufficient funds';
        await transaction.save();
        throw new ApiError(400, 'Insufficient funds');
      }
      
      balance.deductFunds(deductAmount, transaction._id);
    }
    
    await balance.save();
    
    // Update transaction status
    transaction.status = 'completed';
    await transaction.save();
    
    // Publish adjustment completed message
    await publishMessage('transaction.adjustment_completed', {
      transactionId: transaction._id,
      userId: transaction.userId,
      amount: transaction.amount
    });
    
    return transaction;
  } catch (error) {
    logger.error(`Process adjustment transaction error: ${error.message}`);
    
    // Update transaction status if not already updated
    if (transaction.status !== 'failed') {
      transaction.status = 'failed';
      transaction.metadata.failureReason = error.message;
      await transaction.save();
    }
    
    throw error;
  }
};

/**
 * Complete a payment transaction
 * @param {String} transactionId - Transaction ID
 * @param {Boolean} success - Whether payment was successful
 * @param {String} reason - Failure reason (if applicable)
 * @returns {Promise<Object>} - Updated transaction
 */
const completePaymentTransaction = async (transactionId, success, reason = null) => {
  try {
    // Find transaction
    const transaction = await Transaction.findById(transactionId);
    
    if (!transaction) {
      throw new ApiError(404, 'Transaction not found');
    }
    
    if (transaction.status !== 'pending') {
      throw new ApiError(400, `Transaction is already ${transaction.status}`);
    }
    
    // Get balance
    const balance = await Balance.findOne({ userId: transaction.userId });
    
    if (!balance) {
      throw new ApiError(404, 'Balance not found');
    }
    
    if (success) {
      // Successful payment - deduct reserved funds
      balance.deductReservedFunds(transaction.amount, transaction._id);
      await balance.save();
      
      // Update transaction status
      transaction.status = 'completed';
      await transaction.save();
      
      // Publish payment completed message
      await publishMessage('transaction.payment_completed', {
        transactionId: transaction._id,
        userId: transaction.userId,
        amount: transaction.amount,
        provider: transaction.provider
      });
    } else {
      // Failed payment - release reserved funds
      balance.releaseReservedFunds(transaction.amount, transaction._id);
      await balance.save();
      
      // Update transaction status
      transaction.status = 'failed';
      transaction.metadata.failureReason = reason || 'Payment failed';
      await transaction.save();
      
      // Publish payment failed message
      await publishMessage('transaction.payment_failed', {
        transactionId: transaction._id,
        userId: transaction.userId,
        amount: transaction.amount,
        provider: transaction.provider,
        reason: reason || 'Payment failed'
      });
    }
    
    return transaction;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Complete payment transaction error: ${error.message}`);
    throw new ApiError(500, 'Failed to complete payment transaction');
  }
};

/**
 * Complete a withdrawal transaction
 * @param {String} transactionId - Transaction ID
 * @param {Boolean} success - Whether withdrawal was successful
 * @param {String} reason - Failure reason (if applicable)
 * @returns {Promise<Object>} - Updated transaction
 */
const completeWithdrawalTransaction = async (transactionId, success, reason = null) => {
  try {
    // Find transaction
    const transaction = await Transaction.findById(transactionId);
    
    if (!transaction) {
      throw new ApiError(404, 'Transaction not found');
    }
    
    if (transaction.status !== 'pending') {
      throw new ApiError(400, `Transaction is already ${transaction.status}`);
    }
    
    // Get balance
    const balance = await Balance.findOne({ userId: transaction.userId });
    
    if (!balance) {
      throw new ApiError(404, 'Balance not found');
    }
    
    if (success) {
      // Successful withdrawal - deduct reserved funds
      balance.deductReservedFunds(transaction.amount, transaction._id);
      await balance.save();
      
      // Update transaction status
      transaction.status = 'completed';
      await transaction.save();
      
      // Publish withdrawal completed message
      await publishMessage('transaction.withdrawal_completed', {
        transactionId: transaction._id,
        userId: transaction.userId,
        amount: transaction.amount,
        provider: transaction.provider
      });
    } else {
      // Failed withdrawal - release reserved funds
      balance.releaseReservedFunds(transaction.amount, transaction._id);
      await balance.save();
      
      // Update transaction status
      transaction.status = 'failed';
      transaction.metadata.failureReason = reason || 'Withdrawal failed';
      await transaction.save();
      
      // Publish withdrawal failed message
      await publishMessage('transaction.withdrawal_failed', {
        transactionId: transaction._id,
        userId: transaction.userId,
        amount: transaction.amount,
        provider: transaction.provider,
        reason: reason || 'Withdrawal failed'
      });
    }
    
    return transaction;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Complete withdrawal transaction error: ${error.message}`);
    throw new ApiError(500, 'Failed to complete withdrawal transaction');
  }
};

/**
 * Get transaction by ID
 * @param {String} transactionId - Transaction ID
 * @param {String} userId - User ID
 * @returns {Promise<Object>} - Transaction
 */
const getTransactionById = async (transactionId, userId) => {
  try {
    const transaction = await Transaction.findById(transactionId);
    
    if (!transaction) {
      throw new ApiError(404, 'Transaction not found');
    }
    
    // Check if user owns the transaction or is admin
    if (transaction.userId !== userId && !['admin', 'super_admin'].includes(userId)) {
      throw new ApiError(403, 'You do not have permission to view this transaction');
    }
    
    return transaction;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Get transaction error: ${error.message}`);
    throw new ApiError(500, 'Failed to get transaction');
  }
};

/**
 * Get user transactions
 * @param {String} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Transactions with pagination
 */
const getUserTransactions = async (userId, options = {}) => {
  try {
    const { page = 1, limit = 10, type, status, sort = '-createdAt' } = options;
    
    // Build query
    const query = { userId };
    
    if (type) {
      query.type = type;
    }
    
    if (status) {
      query.status = status;
    }
    
    // Execute query with pagination
    const transactions = await Transaction.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);
    
    // Get total count
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
    logger.error(`Get user transactions error: ${error.message}`);
    throw new ApiError(500, 'Failed to get transactions');
  }
};

/**
 * Get all transactions (admin only)
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Transactions with pagination
 */
const getAllTransactions = async (options = {}) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      type, 
      status,
      userId,
      minAmount,
      maxAmount,
      startDate,
      endDate,
      sort = '-createdAt' 
    } = options;
    
    // Build query
    const query = {};
    
    if (type) {
      query.type = type;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (userId) {
      query.userId = userId;
    }
    
    if (minAmount !== undefined || maxAmount !== undefined) {
      query.amount = {};
      
      if (minAmount !== undefined) {
        query.amount.$gte = parseFloat(minAmount);
      }
      
      if (maxAmount !== undefined) {
        query.amount.$lte = parseFloat(maxAmount);
      }
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }
    
    // Execute query with pagination
    const transactions = await Transaction.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);
    
    // Get total count
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
    logger.error(`Get all transactions error: ${error.message}`);
    throw new ApiError(500, 'Failed to get transactions');
  }
};

/**
 * Get transaction statistics
 * @returns {Promise<Object>} - Transaction statistics
 */
const getTransactionStatistics = async () => {
  try {
    // Get total transactions
    const totalTransactions = await Transaction.countDocuments();
    
    // Get total amount
    const totalAmountResult = await Transaction.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    
    const totalAmount = totalAmountResult.length > 0 ? totalAmountResult[0].total : 0;
    
    // Get total fees
    const totalFeesResult = await Transaction.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$fee' }
        }
      }
    ]);
    
    const totalFees = totalFeesResult.length > 0 ? totalFeesResult[0].total : 0;
    
    // Get transaction count by type
    const transactionsByType = await Transaction.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          amount: { $sum: '$amount' }
        }
      }
    ]);
    
    // Get transaction count by status
    const transactionsByStatus = await Transaction.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          amount: { $sum: '$amount' }
        }
      }
    ]);
    
    // Format transaction by type
    const formattedTransactionsByType = {};
    transactionsByType.forEach(item => {
      formattedTransactionsByType[item._id] = {
        count: item.count,
        amount: item.amount
      };
    });
    
    // Format transaction by status
    const formattedTransactionsByStatus = {};
    transactionsByStatus.forEach(item => {
      formattedTransactionsByStatus[item._id] = {
        count: item.count,
        amount: item.amount
      };
    });
    
    return {
      totalTransactions,
      totalAmount,
      totalFees,
      transactionsByType: formattedTransactionsByType,
      transactionsByStatus: formattedTransactionsByStatus
    };
  } catch (error) {
    logger.error(`Get transaction statistics error: ${error.message}`);
    throw new ApiError(500, 'Failed to get transaction statistics');
  }
};

module.exports = {
  createTransaction,
  completePaymentTransaction,
  completeWithdrawalTransaction,
  getTransactionById,
  getUserTransactions,
  getAllTransactions,
  getTransactionStatistics
};
