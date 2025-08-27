const transactionService = require('../services/transaction.service');
const { validateTransactionRequest } = require('../validation/transaction.validation');
const { TransactionError } = require('../utils/errors.util');
const logger = require('../utils/logger.util');

/**
 * Create a new transaction
 */
exports.createTransaction = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Validate request
    const { error, value } = validateTransactionRequest(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid transaction request',
          details: error.details.map(d => ({ field: d.path[0], message: d.message }))
        }
      });
    }
    
    // Ensure userId in the transaction matches the authenticated user
    // (unless admin role)
    if (value.userId && value.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You cannot create transactions for other users'
        }
      });
    }
    
    // Set userId if not provided
    if (!value.userId) {
      value.userId = userId;
    }
    
    // Process transaction
    const result = await transactionService.processTransaction(value);
    
    return res.status(200).json({
      success: true,
      message: 'Transaction processed successfully',
      data: result
    });
  } catch (error) {
    if (error instanceof TransactionError) {
      return res.status(400).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }
    
    logger.error(`Create transaction controller error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during transaction processing'
      }
    });
  }
};

/**
 * Get transaction details
 */
exports.getTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user.userId;
    
    // Get transaction
    const transaction = await transactionService.getTransaction(transactionId);
    
    // Check if user has permission to view this transaction
    if (transaction.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this transaction'
        }
      });
    }
    
    return res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    if (error instanceof TransactionError) {
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
      }
      
      return res.status(400).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }
    
    logger.error(`Get transaction controller error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while retrieving transaction'
      }
    });
  }
};

/**
 * Get transaction history
 */
exports.getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page, limit, transactionType, status, startDate, endDate, walletId } = req.query;
    
    // Get transaction history
    const result = await transactionService.getTransactionHistory(userId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      transactionType,
      status,
      startDate,
      endDate,
      walletId
    });
    
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error(`Get transaction history controller error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while retrieving transaction history'
      }
    });
  }
};