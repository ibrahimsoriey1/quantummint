const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const Payment = require('../models/payment.model');
const Provider = require('../models/provider.model');
const providerFactory = require('../providers/provider.factory');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const { publishMessage } = require('../config/messageQueue');
require('dotenv').config();

/**
 * Create a payment
 * @param {Object} data - Payment data
 * @returns {Promise<Object>} - Created payment
 */
const createPayment = async (data) => {
  try {
    const { 
      userId, 
      transactionId, 
      provider, 
      amount, 
      currency = 'USD', 
      description,
      recipientInfo,
      metadata = {},
      ipAddress,
      userAgent
    } = data;
    
    // Validate amount
    if (!amount || amount <= 0) {
      throw new ApiError(400, 'Invalid amount');
    }
    
    // Validate provider
    if (!provider) {
      throw new ApiError(400, 'Provider is required');
    }
    
    // Check if provider is active
    const providerDoc = await Provider.findOne({ code: provider, isActive: true });
    
    if (!providerDoc) {
      throw new ApiError(400, `Payment provider '${provider}' is not available`);
    }
    
    // Check if amount is within provider limits
    if (amount < providerDoc.minAmount || amount > providerDoc.maxAmount) {
      throw new ApiError(400, `Amount must be between ${providerDoc.minAmount} and ${providerDoc.maxAmount}`);
    }
    
    // Check if currency is supported
    if (providerDoc.supportedCurrencies.length > 0 && !providerDoc.supportedCurrencies.includes(currency)) {
      throw new ApiError(400, `Currency '${currency}' is not supported by this provider`);
    }
    
    // Check if KYC level is sufficient
    if (providerDoc.requiredKycLevel !== 'none') {
      try {
        // Call KYC service to verify user's KYC level
        const kycResponse = await axios.get(
          `${process.env.KYC_SERVICE_URL}/verify/${userId}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'x-service-key': process.env.SERVICE_KEY
            }
          }
        );
        
        if (!kycResponse.data.success) {
          throw new ApiError(403, 'KYC verification failed');
        }
        
        const userKycLevel = kycResponse.data.kycLevel;
        const requiredLevel = providerDoc.requiredKycLevel;
        
        // Check if user's KYC level is sufficient
        const kycLevels = ['none', 'tier_1', 'tier_2', 'tier_3'];
        const userKycIndex = kycLevels.indexOf(userKycLevel);
        const requiredKycIndex = kycLevels.indexOf(requiredLevel);
        
        if (userKycIndex < requiredKycIndex) {
          throw new ApiError(403, `KYC level '${requiredLevel}' is required for this payment method`);
        }
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        
        logger.error(`KYC verification error: ${error.message}`);
        throw new ApiError(500, 'Failed to verify KYC level');
      }
    }
    
    // Calculate fee
    const fee = providerFactory.calculateFee(provider, amount, currency);
    
    // Create payment record
    const payment = new Payment({
      userId,
      transactionId,
      type: 'payment',
      provider,
      amount,
      fee,
      currency,
      status: 'pending',
      recipientInfo,
      metadata,
      ipAddress,
      userAgent
    });
    
    await payment.save();
    
    // Create payment with provider
    const providerPaymentData = {
      amount,
      currency,
      description: description || `Payment for transaction ${transactionId}`,
      metadata: {
        userId,
        paymentId: payment._id.toString(),
        transactionId
      },
      ...recipientInfo
    };
    
    const providerResponse = await providerFactory.createPayment(provider, providerPaymentData);
    
    // Update payment with provider response
    payment.providerPaymentId = providerResponse.providerPaymentId;
    payment.providerReference = providerResponse.providerReference;
    payment.status = providerResponse.status;
    payment.providerResponse = providerResponse.providerResponse;
    
    await payment.save();
    
    // Publish payment created message
    await publishMessage('payment.created', {
      paymentId: payment._id,
      userId,
      transactionId,
      provider,
      amount,
      status: payment.status
    });
    
    return {
      payment,
      nextAction: providerResponse.nextAction || null
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Payment creation error: ${error.message}`);
    throw new ApiError(500, 'Failed to create payment');
  }
};

/**
 * Create a withdrawal
 * @param {Object} data - Withdrawal data
 * @returns {Promise<Object>} - Created withdrawal
 */
const createWithdrawal = async (data) => {
  try {
    const { 
      userId, 
      transactionId, 
      provider, 
      amount, 
      currency = 'USD', 
      description,
      recipientInfo,
      metadata = {},
      ipAddress,
      userAgent
    } = data;
    
    // Validate amount
    if (!amount || amount <= 0) {
      throw new ApiError(400, 'Invalid amount');
    }
    
    // Validate provider
    if (!provider) {
      throw new ApiError(400, 'Provider is required');
    }
    
    // Validate recipient info
    if (!recipientInfo) {
      throw new ApiError(400, 'Recipient information is required');
    }
    
    // Check if provider is active
    const providerDoc = await Provider.findOne({ code: provider, isActive: true });
    
    if (!providerDoc) {
      throw new ApiError(400, `Payment provider '${provider}' is not available`);
    }
    
    // Check if amount is within provider limits
    if (amount < providerDoc.minAmount || amount > providerDoc.maxAmount) {
      throw new ApiError(400, `Amount must be between ${providerDoc.minAmount} and ${providerDoc.maxAmount}`);
    }
    
    // Check if currency is supported
    if (providerDoc.supportedCurrencies.length > 0 && !providerDoc.supportedCurrencies.includes(currency)) {
      throw new ApiError(400, `Currency '${currency}' is not supported by this provider`);
    }
    
    // Check if KYC level is sufficient
    if (providerDoc.requiredKycLevel !== 'none') {
      try {
        // Call KYC service to verify user's KYC level
        const kycResponse = await axios.get(
          `${process.env.KYC_SERVICE_URL}/verify/${userId}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'x-service-key': process.env.SERVICE_KEY
            }
          }
        );
        
        if (!kycResponse.data.success) {
          throw new ApiError(403, 'KYC verification failed');
        }
        
        const userKycLevel = kycResponse.data.kycLevel;
        const requiredLevel = providerDoc.requiredKycLevel;
        
        // Check if user's KYC level is sufficient
        const kycLevels = ['none', 'tier_1', 'tier_2', 'tier_3'];
        const userKycIndex = kycLevels.indexOf(userKycLevel);
        const requiredKycIndex = kycLevels.indexOf(requiredLevel);
        
        if (userKycIndex < requiredKycIndex) {
          throw new ApiError(403, `KYC level '${requiredLevel}' is required for this withdrawal method`);
        }
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        
        logger.error(`KYC verification error: ${error.message}`);
        throw new ApiError(500, 'Failed to verify KYC level');
      }
    }
    
    // Calculate fee
    const fee = providerFactory.calculateFee(provider, amount, currency);
    
    // Create payment record
    const payment = new Payment({
      userId,
      transactionId,
      type: 'withdrawal',
      provider,
      amount,
      fee,
      currency,
      status: 'pending',
      recipientInfo,
      metadata,
      ipAddress,
      userAgent
    });
    
    await payment.save();
    
    // Create withdrawal with provider
    const providerWithdrawalData = {
      amount,
      currency,
      description: description || `Withdrawal for transaction ${transactionId}`,
      metadata: {
        userId,
        paymentId: payment._id.toString(),
        transactionId
      },
      ...recipientInfo
    };
    
    const providerResponse = await providerFactory.createWithdrawal(provider, providerWithdrawalData);
    
    // Update payment with provider response
    payment.providerPaymentId = providerResponse.providerPaymentId;
    payment.providerReference = providerResponse.providerReference;
    payment.status = providerResponse.status;
    payment.providerResponse = providerResponse.providerResponse;
    
    await payment.save();
    
    // Publish withdrawal created message
    await publishMessage('payment.withdrawal_created', {
      paymentId: payment._id,
      userId,
      transactionId,
      provider,
      amount,
      status: payment.status
    });
    
    return {
      payment,
      nextAction: providerResponse.nextAction || null
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Withdrawal creation error: ${error.message}`);
    throw new ApiError(500, 'Failed to create withdrawal');
  }
};

/**
 * Get payment by ID
 * @param {String} paymentId - Payment ID
 * @returns {Promise<Object>} - Payment
 */
const getPaymentById = async (paymentId) => {
  try {
    const payment = await Payment.findById(paymentId);
    
    if (!payment) {
      throw new ApiError(404, 'Payment not found');
    }
    
    return payment;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Get payment error: ${error.message}`);
    throw new ApiError(500, 'Failed to get payment');
  }
};

/**
 * Get payment status
 * @param {String} paymentId - Payment ID
 * @returns {Promise<Object>} - Payment status
 */
const getPaymentStatus = async (paymentId) => {
  try {
    const payment = await Payment.findById(paymentId);
    
    if (!payment) {
      throw new ApiError(404, 'Payment not found');
    }
    
    // If payment is already completed, failed, or cancelled, return current status
    if (['completed', 'failed', 'cancelled', 'refunded'].includes(payment.status)) {
      return payment;
    }
    
    // Get status from provider
    const providerResponse = payment.type === 'payment'
      ? await providerFactory.getPaymentStatus(payment.provider, payment.providerPaymentId)
      : await providerFactory.getWithdrawalStatus(payment.provider, payment.providerPaymentId);
    
    // Update payment status if changed
    if (providerResponse.status !== payment.status) {
      payment.status = providerResponse.status;
      payment.providerResponse = providerResponse.providerResponse;
      
      // If payment is completed, update completedAt
      if (payment.status === 'completed') {
        payment.completedAt = new Date();
        
        // Publish payment completed message
        await publishMessage(`payment.${payment.type}_completed`, {
          paymentId: payment._id,
          userId: payment.userId,
          transactionId: payment.transactionId,
          provider: payment.provider,
          amount: payment.amount
        });
        
        // Update transaction status
        try {
          await axios.post(
            `${process.env.TRANSACTION_SERVICE_URL}/complete-${payment.type}/${payment.transactionId}`,
            {
              success: true
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'x-service-key': process.env.SERVICE_KEY
              }
            }
          );
        } catch (error) {
          logger.error(`Failed to update transaction status: ${error.message}`);
          // Continue even if transaction update fails
        }
      } else if (['failed', 'cancelled'].includes(payment.status)) {
        // Publish payment failed message
        await publishMessage(`payment.${payment.type}_failed`, {
          paymentId: payment._id,
          userId: payment.userId,
          transactionId: payment.transactionId,
          provider: payment.provider,
          amount: payment.amount,
          reason: 'Provider reported failure'
        });
        
        // Update transaction status
        try {
          await axios.post(
            `${process.env.TRANSACTION_SERVICE_URL}/complete-${payment.type}/${payment.transactionId}`,
            {
              success: false,
              reason: 'Provider reported failure'
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'x-service-key': process.env.SERVICE_KEY
              }
            }
          );
        } catch (error) {
          logger.error(`Failed to update transaction status: ${error.message}`);
          // Continue even if transaction update fails
        }
      }
      
      await payment.save();
    }
    
    return payment;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Get payment status error: ${error.message}`);
    throw new ApiError(500, 'Failed to get payment status');
  }
};

/**
 * Get user payments
 * @param {String} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Payments with pagination
 */
const getUserPayments = async (userId, options = {}) => {
  try {
    const { page = 1, limit = 10, type, provider, status, sort = '-createdAt' } = options;
    
    // Build query
    const query = { userId };
    
    if (type) {
      query.type = type;
    }
    
    if (provider) {
      query.provider = provider;
    }
    
    if (status) {
      query.status = status;
    }
    
    // Execute query with pagination
    const payments = await Payment.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);
    
    // Get total count
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
    logger.error(`Get user payments error: ${error.message}`);
    throw new ApiError(500, 'Failed to get payments');
  }
};

/**
 * Get all payments (admin only)
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Payments with pagination
 */
const getAllPayments = async (options = {}) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      type, 
      provider,
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
    
    if (provider) {
      query.provider = provider;
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
    const payments = await Payment.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);
    
    // Get total count
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
    logger.error(`Get all payments error: ${error.message}`);
    throw new ApiError(500, 'Failed to get payments');
  }
};

/**
 * Refund payment
 * @param {String} paymentId - Payment ID
 * @param {Object} data - Refund data
 * @returns {Promise<Object>} - Refunded payment
 */
const refundPayment = async (paymentId, data = {}) => {
  try {
    const { amount, reason = 'requested_by_customer' } = data;
    
    // Find payment
    const payment = await Payment.findById(paymentId);
    
    if (!payment) {
      throw new ApiError(404, 'Payment not found');
    }
    
    // Check if payment is refundable
    if (payment.type !== 'payment') {
      throw new ApiError(400, 'Only payments can be refunded');
    }
    
    if (payment.status !== 'completed') {
      throw new ApiError(400, `Payment with status '${payment.status}' cannot be refunded`);
    }
    
    // Refund payment with provider
    const refundResponse = await providerFactory.refundPayment(
      payment.provider,
      payment.providerPaymentId,
      { amount, reason }
    );
    
    // Update payment
    payment.status = 'refunded';
    payment.metadata = {
      ...payment.metadata,
      refund: {
        id: refundResponse.refundId,
        amount: amount || payment.amount,
        reason,
        date: new Date()
      }
    };
    
    await payment.save();
    
    // Publish refund message
    await publishMessage('payment.refunded', {
      paymentId: payment._id,
      userId: payment.userId,
      transactionId: payment.transactionId,
      provider: payment.provider,
      amount: amount || payment.amount,
      reason
    });
    
    return payment;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Refund payment error: ${error.message}`);
    throw new ApiError(500, 'Failed to refund payment');
  }
};

/**
 * Cancel payment
 * @param {String} paymentId - Payment ID
 * @param {Object} data - Cancel data
 * @returns {Promise<Object>} - Cancelled payment
 */
const cancelPayment = async (paymentId, data = {}) => {
  try {
    const { reason = 'requested_by_customer' } = data;
    
    // Find payment
    const payment = await Payment.findById(paymentId);
    
    if (!payment) {
      throw new ApiError(404, 'Payment not found');
    }
    
    // Check if payment is cancellable
    if (!['pending', 'processing'].includes(payment.status)) {
      throw new ApiError(400, `Payment with status '${payment.status}' cannot be cancelled`);
    }
    
    // Cancel payment with provider
    if (payment.type === 'payment') {
      // For payments, we might need to refund if already processed
      if (payment.status === 'processing') {
        await providerFactory.refundPayment(
          payment.provider,
          payment.providerPaymentId,
          { reason }
        );
      }
    } else if (payment.type === 'withdrawal') {
      // For withdrawals, use cancel method
      await providerFactory.cancelWithdrawal(
        payment.provider,
        payment.providerPaymentId
      );
    }
    
    // Update payment
    payment.status = 'cancelled';
    payment.metadata = {
      ...payment.metadata,
      cancellation: {
        reason,
        date: new Date()
      }
    };
    
    await payment.save();
    
    // Publish cancellation message
    await publishMessage(`payment.${payment.type}_cancelled`, {
      paymentId: payment._id,
      userId: payment.userId,
      transactionId: payment.transactionId,
      provider: payment.provider,
      amount: payment.amount,
      reason
    });
    
    // Update transaction status
    try {
      await axios.post(
        `${process.env.TRANSACTION_SERVICE_URL}/complete-${payment.type}/${payment.transactionId}`,
        {
          success: false,
          reason: 'Payment cancelled'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-service-key': process.env.SERVICE_KEY
          }
        }
      );
    } catch (error) {
      logger.error(`Failed to update transaction status: ${error.message}`);
      // Continue even if transaction update fails
    }
    
    return payment;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Cancel payment error: ${error.message}`);
    throw new ApiError(500, 'Failed to cancel payment');
  }
};

/**
 * Process webhook
 * @param {String} provider - Provider code
 * @param {Object} data - Webhook data
 * @returns {Promise<Object>} - Processed webhook
 */
const processWebhook = async (provider, data) => {
  try {
    const { event, payload, signature, timestamp } = data;
    
    // Verify webhook signature if provided
    let verifiedEvent = event;
    
    if (payload && signature) {
      const verificationResult = providerFactory.verifyWebhook(provider, payload, signature, timestamp);
      verifiedEvent = verificationResult.event;
    }
    
    // Process webhook event
    const processedEvent = providerFactory.processWebhookEvent(provider, verifiedEvent);
    
    // If event is not handled, return
    if (!processedEvent.handled) {
      return {
        success: true,
        handled: false,
        message: processedEvent.message
      };
    }
    
    // Find payment by provider payment ID
    const payment = await Payment.findOne({ 
      provider, 
      providerPaymentId: processedEvent.paymentId 
    });
    
    if (!payment) {
      logger.error(`Payment not found for webhook: ${processedEvent.paymentId}`);
      return {
        success: false,
        handled: true,
        message: 'Payment not found'
      };
    }
    
    // Update payment status
    payment.status = processedEvent.status;
    payment.webhookReceived = true;
    payment.webhookData = processedEvent.eventData;
    
    // If payment is completed, update completedAt
    if (payment.status === 'completed') {
      payment.completedAt = new Date();
      
      // Publish payment completed message
      await publishMessage(`payment.${payment.type}_completed`, {
        paymentId: payment._id,
        userId: payment.userId,
        transactionId: payment.transactionId,
        provider: payment.provider,
        amount: payment.amount
      });
      
      // Update transaction status
      try {
        await axios.post(
          `${process.env.TRANSACTION_SERVICE_URL}/complete-${payment.type}/${payment.transactionId}`,
          {
            success: true
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-service-key': process.env.SERVICE_KEY
            }
          }
        );
      } catch (error) {
        logger.error(`Failed to update transaction status: ${error.message}`);
        // Continue even if transaction update fails
      }
    } else if (['failed', 'cancelled'].includes(payment.status)) {
      // Publish payment failed message
      await publishMessage(`payment.${payment.type}_failed`, {
        paymentId: payment._id,
        userId: payment.userId,
        transactionId: payment.transactionId,
        provider: payment.provider,
        amount: payment.amount,
        reason: 'Provider webhook reported failure'
      });
      
      // Update transaction status
      try {
        await axios.post(
          `${process.env.TRANSACTION_SERVICE_URL}/complete-${payment.type}/${payment.transactionId}`,
          {
            success: false,
            reason: 'Provider webhook reported failure'
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-service-key': process.env.SERVICE_KEY
            }
          }
        );
      } catch (error) {
        logger.error(`Failed to update transaction status: ${error.message}`);
        // Continue even if transaction update fails
      }
    }
    
    await payment.save();
    
    return {
      success: true,
      handled: true,
      payment
    };
  } catch (error) {
    logger.error(`Process webhook error: ${error.message}`);
    throw new ApiError(500, 'Failed to process webhook');
  }
};

/**
 * Get payment statistics
 * @returns {Promise<Object>} - Payment statistics
 */
const getPaymentStatistics = async () => {
  try {
    // Get total payments
    const totalPayments = await Payment.countDocuments({ type: 'payment' });
    
    // Get total withdrawals
    const totalWithdrawals = await Payment.countDocuments({ type: 'withdrawal' });
    
    // Get total payment amount
    const totalPaymentAmountResult = await Payment.aggregate([
      {
        $match: { type: 'payment', status: 'completed' }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    
    const totalPaymentAmount = totalPaymentAmountResult.length > 0 ? totalPaymentAmountResult[0].total : 0;
    
    // Get total withdrawal amount
    const totalWithdrawalAmountResult = await Payment.aggregate([
      {
        $match: { type: 'withdrawal', status: 'completed' }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    
    const totalWithdrawalAmount = totalWithdrawalAmountResult.length > 0 ? totalWithdrawalAmountResult[0].total : 0;
    
    // Get total fees
    const totalFeesResult = await Payment.aggregate([
      {
        $match: { status: 'completed' }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$fee' }
        }
      }
    ]);
    
    const totalFees = totalFeesResult.length > 0 ? totalFeesResult[0].total : 0;
    
    // Get payment count by provider
    const paymentsByProvider = await Payment.aggregate([
      {
        $match: { type: 'payment' }
      },
      {
        $group: {
          _id: '$provider',
          count: { $sum: 1 },
          amount: { $sum: '$amount' }
        }
      }
    ]);
    
    // Get withdrawal count by provider
    const withdrawalsByProvider = await Payment.aggregate([
      {
        $match: { type: 'withdrawal' }
      },
      {
        $group: {
          _id: '$provider',
          count: { $sum: 1 },
          amount: { $sum: '$amount' }
        }
      }
    ]);
    
    // Get payment count by status
    const paymentsByStatus = await Payment.aggregate([
      {
        $match: { type: 'payment' }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          amount: { $sum: '$amount' }
        }
      }
    ]);
    
    // Get withdrawal count by status
    const withdrawalsByStatus = await Payment.aggregate([
      {
        $match: { type: 'withdrawal' }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          amount: { $sum: '$amount' }
        }
      }
    ]);
    
    // Format provider statistics
    const formattedPaymentsByProvider = {};
    paymentsByProvider.forEach(item => {
      formattedPaymentsByProvider[item._id] = {
        count: item.count,
        amount: item.amount
      };
    });
    
    const formattedWithdrawalsByProvider = {};
    withdrawalsByProvider.forEach(item => {
      formattedWithdrawalsByProvider[item._id] = {
        count: item.count,
        amount: item.amount
      };
    });
    
    // Format status statistics
    const formattedPaymentsByStatus = {};
    paymentsByStatus.forEach(item => {
      formattedPaymentsByStatus[item._id] = {
        count: item.count,
        amount: item.amount
      };
    });
    
    const formattedWithdrawalsByStatus = {};
    withdrawalsByStatus.forEach(item => {
      formattedWithdrawalsByStatus[item._id] = {
        count: item.count,
        amount: item.amount
      };
    });
    
    return {
      totalPayments,
      totalWithdrawals,
      totalPaymentAmount,
      totalWithdrawalAmount,
      totalFees,
      paymentsByProvider: formattedPaymentsByProvider,
      withdrawalsByProvider: formattedWithdrawalsByProvider,
      paymentsByStatus: formattedPaymentsByStatus,
      withdrawalsByStatus: formattedWithdrawalsByStatus
    };
  } catch (error) {
    logger.error(`Get payment statistics error: ${error.message}`);
    throw new ApiError(500, 'Failed to get payment statistics');
  }
};

module.exports = {
  createPayment,
  createWithdrawal,
  getPaymentById,
  getPaymentStatus,
  getUserPayments,
  getAllPayments,
  refundPayment,
  cancelPayment,
  processWebhook,
  getPaymentStatistics
};