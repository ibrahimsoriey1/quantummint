const transactionService = require('../services/transaction.service');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

/**
 * Create transaction
 * @route POST /api/transactions
 */
exports.createTransaction = async (req, res, next) => {
  try {
    const { 
      type, 
      amount, 
      fee, 
      description, 
      reference,
      method,
      provider,
      recipientId,
      recipientInfo,
      metadata
    } = req.body;
    
    const userId = req.user.id;
    
    // Create transaction with client info
    const transaction = await transactionService.createTransaction({
      userId,
      type,
      amount,
      fee,
      description,
      reference,
      method,
      provider,
      recipientId,
      recipientInfo,
      metadata,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: transaction
    });
  } catch (error) {
    logger.error(`Create transaction error: ${error.message}`);
    next(error);
  }
};

/**
 * Get transaction by ID
 * @route GET /api/transactions/:id
 */
exports.getTransactionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const transaction = await transactionService.getTransactionById(id, userId);
    
    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    logger.error(`Get transaction error: ${error.message}`);
    next(error);
  }
};

/**
 * Get user transactions
 * @route GET /api/transactions
 */
exports.getUserTransactions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page, limit, type, status, sort } = req.query;
    
    const result = await transactionService.getUserTransactions(userId, {
      page,
      limit,
      type,
      status,
      sort
    });
    
    res.status(200).json({
      success: true,
      data: result.transactions,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error(`Get user transactions error: ${error.message}`);
    next(error);
  }
};

/**
 * Create internal transaction (service to service)
 * @route POST /api/transactions/internal
 */
exports.createInternalTransaction = async (req, res, next) => {
  try {
    const { 
      userId, 
      type, 
      amount, 
      fee, 
      description, 
      reference,
      method,
      provider,
      recipientId,
      recipientInfo,
      metadata
    } = req.body;
    
    // Create transaction
    const transaction = await transactionService.createTransaction({
      userId,
      type,
      amount,
      fee,
      description,
      reference,
      method,
      provider,
      recipientId,
      recipientInfo,
      metadata
    });
    
    res.status(201).json({
      success: true,
      message: 'Internal transaction created successfully',
      data: transaction
    });
  } catch (error) {
    logger.error(`Create internal transaction error: ${error.message}`);
    next(error);
  }
};

/**
 * Complete payment transaction
 * @route POST /api/transactions/complete-payment/:id
 */
exports.completePaymentTransaction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { success, reason } = req.body;
    
    const transaction = await transactionService.completePaymentTransaction(id, success, reason);
    
    res.status(200).json({
      success: true,
      message: `Payment transaction ${success ? 'completed' : 'failed'} successfully`,
      data: transaction
    });
  } catch (error) {
    logger.error(`Complete payment transaction error: ${error.message}`);
    next(error);
  }
};

/**
 * Complete withdrawal transaction
 * @route POST /api/transactions/complete-withdrawal/:id
 */
exports.completeWithdrawalTransaction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { success, reason } = req.body;
    
    const transaction = await transactionService.completeWithdrawalTransaction(id, success, reason);
    
    res.status(200).json({
      success: true,
      message: `Withdrawal transaction ${success ? 'completed' : 'failed'} successfully`,
      data: transaction
    });
  } catch (error) {
    logger.error(`Complete withdrawal transaction error: ${error.message}`);
    next(error);
  }
};

/**
 * Get all transactions (admin only)
 * @route GET /api/transactions/admin/all
 */
exports.getAllTransactions = async (req, res, next) => {
  try {
    const { 
      page, 
      limit, 
      type, 
      status,
      userId,
      minAmount,
      maxAmount,
      startDate,
      endDate,
      sort 
    } = req.query;
    
    const result = await transactionService.getAllTransactions({
      page,
      limit,
      type,
      status,
      userId,
      minAmount,
      maxAmount,
      startDate,
      endDate,
      sort
    });
    
    res.status(200).json({
      success: true,
      data: result.transactions,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error(`Get all transactions error: ${error.message}`);
    next(error);
  }
};

/**
 * Get transaction statistics (admin only)
 * @route GET /api/transactions/admin/statistics
 */
exports.getTransactionStatistics = async (req, res, next) => {
  try {
    const statistics = await transactionService.getTransactionStatistics();
    
    res.status(200).json({
      success: true,
      data: statistics
    });
  } catch (error) {
    logger.error(`Get transaction statistics error: ${error.message}`);
    next(error);
  }
};