# Transaction Processing Implementation

This document outlines the implementation of the transaction processing functionality for the Digital Money Generation System.

## Overview

The transaction processing system handles all financial transactions within the platform, including money generation, transfers between wallets, and cash-outs to external payment providers. It ensures that transactions are processed securely, accurately, and with proper audit trails.

## Key Components

1. Transaction service for processing different types of transactions
2. Transaction models and database schema
3. Transaction validation and verification
4. Transaction history and reporting
5. Integration with other system components

## Implementation Details

### 1. Transaction Service

```javascript
// transaction-service/src/services/transaction.service.js

const mongoose = require('mongoose');
const Transaction = require('../models/transaction.model');
const Wallet = require('../models/wallet.model');
const { publishEvent } = require('../utils/event.util');
const { TransactionError } = require('../utils/errors.util');
const logger = require('../utils/logger.util');

/**
 * Transaction Service
 * Handles all transaction processing in the system
 */
class TransactionService {
  /**
   * Process a new transaction
   * @param {Object} transactionData - Transaction data
   * @returns {Promise<Object>} Processed transaction
   */
  async processTransaction(transactionData) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Validate transaction data
      this._validateTransactionData(transactionData);
      
      const {
        transactionType,
        sourceType,
        sourceId,
        destinationType,
        destinationId,
        userId,
        amount,
        currency,
        fee = 0,
        description,
        reference,
        metadata = {}
      } = transactionData;
      
      // Check if transaction with this reference already exists
      if (reference) {
        const existingTransaction = await Transaction.findOne({ reference });
        if (existingTransaction) {
          throw new TransactionError('Transaction with this reference already exists', 'DUPLICATE_REFERENCE');
        }
      }
      
      // Create transaction record
      const transaction = new Transaction({
        transactionType,
        sourceType,
        sourceId,
        destinationType,
        destinationId,
        userId,
        amount,
        currency,
        fee,
        status: 'pending',
        description,
        reference: reference || this._generateReference(transactionType),
        metadata
      });
      
      await transaction.save({ session });
      
      // Process transaction based on type
      switch (transactionType) {
        case 'generation':
          await this._processGenerationTransaction(transaction, session);
          break;
        
        case 'transfer':
          await this._processTransferTransaction(transaction, session);
          break;
        
        case 'cash_out':
          await this._processCashOutTransaction(transaction, session);
          break;
        
        case 'refund':
          await this._processRefundTransaction(transaction, session);
          break;
        
        default:
          throw new TransactionError(`Unsupported transaction type: ${transactionType}`, 'UNSUPPORTED_TYPE');
      }
      
      // Update transaction status
      transaction.status = 'completed';
      transaction.completedAt = new Date();
      
      await transaction.save({ session });
      
      // Publish transaction completed event
      await publishEvent('transaction.completed', {
        transactionId: transaction._id.toString(),
        transactionType,
        userId,
        amount,
        currency,
        sourceType,
        sourceId,
        destinationType,
        destinationId,
        reference: transaction.reference
      });
      
      await session.commitTransaction();
      
      logger.info(`Transaction processed successfully: ${transaction._id} (${transactionType})`);
      
      return {
        transactionId: transaction._id.toString(),
        reference: transaction.reference,
        status: transaction.status,
        amount,
        currency,
        fee,
        transactionType,
        createdAt: transaction.createdAt,
        completedAt: transaction.completedAt
      };
    } catch (error) {
      await session.abortTransaction();
      
      if (error instanceof TransactionError) {
        logger.warn(`Transaction error: ${error.message} (${error.code})`);
        throw error;
      }
      
      logger.error(`Transaction processing error: ${error.message}`);
      throw new TransactionError('Failed to process transaction', 'PROCESSING_FAILED');
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Get transaction by ID
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Transaction details
   */
  async getTransaction(transactionId) {
    try {
      const transaction = await Transaction.findById(transactionId);
      
      if (!transaction) {
        throw new TransactionError('Transaction not found', 'NOT_FOUND');
      }
      
      return {
        transactionId: transaction._id.toString(),
        transactionType: transaction.transactionType,
        sourceType: transaction.sourceType,
        sourceId: transaction.sourceId,
        destinationType: transaction.destinationType,
        destinationId: transaction.destinationId,
        userId: transaction.userId.toString(),
        amount: transaction.amount,
        currency: transaction.currency,
        fee: transaction.fee,
        status: transaction.status,
        description: transaction.description,
        reference: transaction.reference,
        metadata: transaction.metadata,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
        completedAt: transaction.completedAt
      };
    } catch (error) {
      if (error instanceof TransactionError) {
        throw error;
      }
      
      logger.error(`Get transaction error: ${error.message}`);
      throw new TransactionError('Failed to get transaction', 'RETRIEVAL_FAILED');
    }
  }
  
  /**
   * Get transaction history for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options (pagination, filters)
   * @returns {Promise<Object>} Transaction history with pagination
   */
  async getTransactionHistory(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        transactionType,
        status,
        startDate,
        endDate,
        walletId
      } = options;
      
      const query = { userId };
      
      if (transactionType) {
        query.transactionType = transactionType;
      }
      
      if (status) {
        query.status = status;
      }
      
      if (walletId) {
        query.$or = [
          { sourceId: walletId, sourceType: 'wallet' },
          { destinationId: walletId, destinationType: 'wallet' }
        ];
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
      
      const skip = (page - 1) * limit;
      
      const [transactions, total] = await Promise.all([
        Transaction.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Transaction.countDocuments(query)
      ]);
      
      const formattedTransactions = transactions.map(tx => ({
        transactionId: tx._id.toString(),
        transactionType: tx.transactionType,
        amount: tx.amount,
        currency: tx.currency,
        fee: tx.fee,
        status: tx.status,
        description: tx.description,
        reference: tx.reference,
        createdAt: tx.createdAt,
        completedAt: tx.completedAt
      }));
      
      return {
        transactions: formattedTransactions,
        pagination: {
          totalItems: total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          itemsPerPage: limit
        }
      };
    } catch (error) {
      logger.error(`Get transaction history error: ${error.message}`);
      throw new TransactionError('Failed to get transaction history', 'HISTORY_RETRIEVAL_FAILED');
    }
  }
  
  /**
   * Process a generation transaction
   * @param {Object} transaction - Transaction object
   * @param {mongoose.ClientSession} session - Mongoose session
   * @private
   */
  async _processGenerationTransaction(transaction, session) {
    // For generation transactions, money is created in the destination wallet
    if (transaction.destinationType !== 'wallet') {
      throw new TransactionError('Generation destination must be a wallet', 'INVALID_DESTINATION');
    }
    
    // Get destination wallet
    const wallet = await Wallet.findById(transaction.destinationId).session(session);
    
    if (!wallet) {
      throw new TransactionError('Destination wallet not found', 'WALLET_NOT_FOUND');
    }
    
    if (wallet.status !== 'active') {
      throw new TransactionError(`Wallet is ${wallet.status}`, 'WALLET_INACTIVE');
    }
    
    if (wallet.currency !== transaction.currency) {
      throw new TransactionError('Currency mismatch', 'CURRENCY_MISMATCH');
    }
    
    // Update wallet balance
    wallet.balance += transaction.amount;
    await wallet.save({ session });
    
    logger.info(`Generation transaction completed: ${transaction.amount} ${transaction.currency} added to wallet ${wallet._id}`);
  }
  
  /**
   * Process a transfer transaction
   * @param {Object} transaction - Transaction object
   * @param {mongoose.ClientSession} session - Mongoose session
   * @private
   */
  async _processTransferTransaction(transaction, session) {
    // For transfer transactions, money moves from source wallet to destination wallet
    if (transaction.sourceType !== 'wallet' || transaction.destinationType !== 'wallet') {
      throw new TransactionError('Transfer must be between wallets', 'INVALID_TRANSFER_TYPE');
    }
    
    // Get source wallet
    const sourceWallet = await Wallet.findById(transaction.sourceId).session(session);
    
    if (!sourceWallet) {
      throw new TransactionError('Source wallet not found', 'SOURCE_WALLET_NOT_FOUND');
    }
    
    if (sourceWallet.status !== 'active') {
      throw new TransactionError(`Source wallet is ${sourceWallet.status}`, 'SOURCE_WALLET_INACTIVE');
    }
    
    if (sourceWallet.currency !== transaction.currency) {
      throw new TransactionError('Currency mismatch with source wallet', 'CURRENCY_MISMATCH');
    }
    
    // Check if source wallet has sufficient balance
    const totalAmount = transaction.amount + transaction.fee;
    
    if (sourceWallet.balance < totalAmount) {
      throw new TransactionError('Insufficient balance', 'INSUFFICIENT_BALANCE');
    }
    
    // Get destination wallet
    const destinationWallet = await Wallet.findById(transaction.destinationId).session(session);
    
    if (!destinationWallet) {
      throw new TransactionError('Destination wallet not found', 'DESTINATION_WALLET_NOT_FOUND');
    }
    
    if (destinationWallet.status !== 'active') {
      throw new TransactionError(`Destination wallet is ${destinationWallet.status}`, 'DESTINATION_WALLET_INACTIVE');
    }
    
    if (destinationWallet.currency !== transaction.currency) {
      throw new TransactionError('Currency mismatch with destination wallet', 'CURRENCY_MISMATCH');
    }
    
    // Update wallet balances
    sourceWallet.balance -= totalAmount;
    destinationWallet.balance += transaction.amount;
    
    await sourceWallet.save({ session });
    await destinationWallet.save({ session });
    
    logger.info(`Transfer transaction completed: ${transaction.amount} ${transaction.currency} from wallet ${sourceWallet._id} to wallet ${destinationWallet._id}`);
  }
  
  /**
   * Process a cash out transaction
   * @param {Object} transaction - Transaction object
   * @param {mongoose.ClientSession} session - Mongoose session
   * @private
   */
  async _processCashOutTransaction(transaction, session) {
    // For cash out transactions, money leaves the source wallet to an external destination
    if (transaction.sourceType !== 'wallet' || transaction.destinationType !== 'external') {
      throw new TransactionError('Cash out must be from wallet to external destination', 'INVALID_CASH_OUT_TYPE');
    }
    
    // Get source wallet
    const wallet = await Wallet.findById(transaction.sourceId).session(session);
    
    if (!wallet) {
      throw new TransactionError('Source wallet not found', 'WALLET_NOT_FOUND');
    }
    
    if (wallet.status !== 'active') {
      throw new TransactionError(`Wallet is ${wallet.status}`, 'WALLET_INACTIVE');
    }
    
    if (wallet.currency !== transaction.currency) {
      throw new TransactionError('Currency mismatch', 'CURRENCY_MISMATCH');
    }
    
    // Check if wallet has sufficient balance
    const totalAmount = transaction.amount + transaction.fee;
    
    if (wallet.balance < totalAmount) {
      throw new TransactionError('Insufficient balance', 'INSUFFICIENT_BALANCE');
    }
    
    // Update wallet balance
    wallet.balance -= totalAmount;
    await wallet.save({ session });
    
    // Note: The actual cash out to external provider is handled by the payment integration service
    // This service only updates the internal wallet balance
    
    logger.info(`Cash out transaction prepared: ${transaction.amount} ${transaction.currency} from wallet ${wallet._id} to external destination ${transaction.destinationId}`);
  }
  
  /**
   * Process a refund transaction
   * @param {Object} transaction - Transaction object
   * @param {mongoose.ClientSession} session - Mongoose session
   * @private
   */
  async _processRefundTransaction(transaction, session) {
    // For refund transactions, money is returned to the destination wallet
    if (transaction.destinationType !== 'wallet') {
      throw new TransactionError('Refund destination must be a wallet', 'INVALID_DESTINATION');
    }
    
    // Get destination wallet
    const wallet = await Wallet.findById(transaction.destinationId).session(session);
    
    if (!wallet) {
      throw new TransactionError('Destination wallet not found', 'WALLET_NOT_FOUND');
    }
    
    if (wallet.status !== 'active') {
      throw new TransactionError(`Wallet is ${wallet.status}`, 'WALLET_INACTIVE');
    }
    
    if (wallet.currency !== transaction.currency) {
      throw new TransactionError('Currency mismatch', 'CURRENCY_MISMATCH');
    }
    
    // Check if original transaction exists
    if (!transaction.metadata.originalTransactionId) {
      throw new TransactionError('Original transaction ID is required for refunds', 'MISSING_ORIGINAL_TRANSACTION');
    }
    
    const originalTransaction = await Transaction.findById(transaction.metadata.originalTransactionId);
    
    if (!originalTransaction) {
      throw new TransactionError('Original transaction not found', 'ORIGINAL_TRANSACTION_NOT_FOUND');
    }
    
    // Update wallet balance
    wallet.balance += transaction.amount;
    await wallet.save({ session });
    
    logger.info(`Refund transaction completed: ${transaction.amount} ${transaction.currency} refunded to wallet ${wallet._id}`);
  }
  
  /**
   * Validate transaction data
   * @param {Object} data - Transaction data
   * @throws {TransactionError} If validation fails
   * @private
   */
  _validateTransactionData(data) {
    const requiredFields = [
      'transactionType',
      'sourceType',
      'sourceId',
      'destinationType',
      'destinationId',
      'userId',
      'amount',
      'currency'
    ];
    
    for (const field of requiredFields) {
      if (!data[field]) {
        throw new TransactionError(`Missing required field: ${field}`, 'MISSING_FIELD');
      }
    }
    
    if (data.amount <= 0) {
      throw new TransactionError('Amount must be greater than zero', 'INVALID_AMOUNT');
    }
    
    if (data.fee < 0) {
      throw new TransactionError('Fee cannot be negative', 'INVALID_FEE');
    }
    
    const validTransactionTypes = ['generation', 'transfer', 'cash_out', 'refund'];
    if (!validTransactionTypes.includes(data.transactionType)) {
      throw new TransactionError(`Invalid transaction type: ${data.transactionType}`, 'INVALID_TYPE');
    }
    
    const validSourceTypes = ['wallet', 'system', 'external'];
    if (!validSourceTypes.includes(data.sourceType)) {
      throw new TransactionError(`Invalid source type: ${data.sourceType}`, 'INVALID_SOURCE_TYPE');
    }
    
    const validDestinationTypes = ['wallet', 'external'];
    if (!validDestinationTypes.includes(data.destinationType)) {
      throw new TransactionError(`Invalid destination type: ${data.destinationType}`, 'INVALID_DESTINATION_TYPE');
    }
  }
  
  /**
   * Generate a unique transaction reference
   * @param {string} type - Transaction type
   * @returns {string} Transaction reference
   * @private
   */
  _generateReference(type) {
    const prefix = type.substring(0, 3).toUpperCase();
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${timestamp}-${random}`;
  }
}

module.exports = new TransactionService();
```

### 2. Transaction Model

```javascript
// transaction-service/src/models/transaction.model.js

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionType: {
    type: String,
    enum: ['generation', 'transfer', 'cash_out', 'refund'],
    required: true,
    index: true
  },
  sourceType: {
    type: String,
    enum: ['wallet', 'system', 'external'],
    required: true
  },
  sourceId: {
    type: String,
    required: true
  },
  destinationType: {
    type: String,
    enum: ['wallet', 'external'],
    required: true
  },
  destinationId: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true
  },
  fee: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  description: String,
  reference: {
    type: String,
    unique: true
  },
  metadata: {
    type: Object,
    default: {}
  },
  completedAt: Date,
  failureReason: String
}, {
  timestamps: true
});

// Indexes for queries
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ sourceId: 1, sourceType: 1, createdAt: -1 });
transactionSchema.index({ destinationId: 1, destinationType: 1, createdAt: -1 });
transactionSchema.index({ reference: 1 }, { unique: true });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
```

### 3. Wallet Model

```javascript
// transaction-service/src/models/wallet.model.js

const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  balance: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'USD'
  },
  walletType: {
    type: String,
    enum: ['personal', 'business', 'savings'],
    default: 'personal'
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'closed'],
    default: 'active',
    index: true
  },
  name: {
    type: String,
    default: 'Default Wallet'
  },
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for queries
walletSchema.index({ userId: 1, walletType: 1 });
walletSchema.index({ userId: 1, currency: 1 });

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;
```

### 4. Transaction Controller

```javascript
// transaction-service/src/controllers/transaction.controller.js

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
```

### 5. Transaction Routes

```javascript
// transaction-service/src/routes/transaction.routes.js

const express = require('express');
const transactionController = require('../controllers/transaction.controller');
const authMiddleware = require('../middleware/auth.middleware');
const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware.verifyToken);

// Transaction routes
router.post('/', transactionController.createTransaction);
router.get('/:transactionId', transactionController.getTransaction);
router.get('/', transactionController.getTransactionHistory);

module.exports = router;
```

### 6. Wallet Controller

```javascript
// transaction-service/src/controllers/wallet.controller.js

const walletService = require('../services/wallet.service');
const { validateWalletRequest } = require('../validation/wallet.validation');
const { WalletError } = require('../utils/errors.util');
const logger = require('../utils/logger.util');

/**
 * Create a new wallet
 */
exports.createWallet = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Validate request
    const { error, value } = validateWalletRequest(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid wallet request',
          details: error.details.map(d => ({ field: d.path[0], message: d.message }))
        }
      });
    }
    
    // Ensure userId in the wallet matches the authenticated user
    // (unless admin role)
    if (value.userId && value.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You cannot create wallets for other users'
        }
      });
    }
    
    // Set userId if not provided
    if (!value.userId) {
      value.userId = userId;
    }
    
    // Create wallet
    const wallet = await walletService.createWallet(value);
    
    return res.status(201).json({
      success: true,
      message: 'Wallet created successfully',
      data: wallet
    });
  } catch (error) {
    if (error instanceof WalletError) {
      return res.status(400).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }
    
    logger.error(`Create wallet controller error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during wallet creation'
      }
    });
  }
};

/**
 * Get user wallets
 */
exports.getUserWallets = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get wallets
    const wallets = await walletService.getUserWallets(userId);
    
    return res.status(200).json({
      success: true,
      data: {
        wallets
      }
    });
  } catch (error) {
    logger.error(`Get user wallets controller error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while retrieving wallets'
      }
    });
  }
};

/**
 * Get wallet details
 */
exports.getWallet = async (req, res) => {
  try {
    const { walletId } = req.params;
    const userId = req.user.userId;
    
    // Get wallet
    const wallet = await walletService.getWallet(walletId);
    
    // Check if user has permission to view this wallet
    if (wallet.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this wallet'
        }
      });
    }
    
    return res.status(200).json({
      success: true,
      data: wallet
    });
  } catch (error) {
    if (error instanceof WalletError) {
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
    
    logger.error(`Get wallet controller error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while retrieving wallet'
      }
    });
  }
};
```

### 7. Wallet Service

```javascript
// transaction-service/src/services/wallet.service.js

const Wallet = require('../models/wallet.model');
const { publishEvent } = require('../utils/event.util');
const { WalletError } = require('../utils/errors.util');
const logger = require('../utils/logger.util');

/**
 * Wallet Service
 * Handles wallet operations
 */
class WalletService {
  /**
   * Create a new wallet
   * @param {Object} walletData - Wallet data
   * @returns {Promise<Object>} Created wallet
   */
  async createWallet(walletData) {
    try {
      const {
        userId,
        currency = 'USD',
        walletType = 'personal',
        name = 'Default Wallet',
        metadata = {}
      } = walletData;
      
      // Check if user already has a wallet with this currency and type
      const existingWallet = await Wallet.findOne({
        userId,
        currency,
        walletType
      });
      
      if (existingWallet) {
        throw new WalletError('User already has a wallet with this currency and type', 'DUPLICATE_WALLET');
      }
      
      // Create wallet
      const wallet = new Wallet({
        userId,
        currency,
        walletType,
        name,
        balance: 0,
        status: 'active',
        metadata
      });
      
      await wallet.save();
      
      // Publish wallet created event
      await publishEvent('wallet.created', {
        walletId: wallet._id.toString(),
        userId,
        currency,
        walletType,
        name
      });
      
      logger.info(`Wallet created: ${wallet._id} for user ${userId}`);
      
      return {
        walletId: wallet._id.toString(),
        userId,
        currency,
        walletType,
        name,
        balance: wallet.balance,
        status: wallet.status,
        createdAt: wallet.createdAt
      };
    } catch (error) {
      if (error instanceof WalletError) {
        throw error;
      }
      
      logger.error(`Wallet creation error: ${error.message}`);
      throw new WalletError('Failed to create wallet', 'CREATION_FAILED');
    }
  }
  
  /**
   * Get wallet by ID
   * @param {string} walletId - Wallet ID
   * @returns {Promise<Object>} Wallet details
   */
  async getWallet(walletId) {
    try {
      const wallet = await Wallet.findById(walletId);
      
      if (!wallet) {
        throw new WalletError('Wallet not found', 'NOT_FOUND');
      }
      
      return {
        walletId: wallet._id.toString(),
        userId: wallet.userId.toString(),
        currency: wallet.currency,
        walletType: wallet.walletType,
        name: wallet.name,
        balance: wallet.balance,
        status: wallet.status,
        metadata: wallet.metadata,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt
      };
    } catch (error) {
      if (error instanceof WalletError) {
        throw error;
      }
      
      logger.error(`Get wallet error: ${error.message}`);
      throw new WalletError('Failed to get wallet', 'RETRIEVAL_FAILED');
    }
  }
  
  /**
   * Get wallets for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} User wallets
   */
  async getUserWallets(userId) {
    try {
      const wallets = await Wallet.find({ userId });
      
      return wallets.map(wallet => ({
        walletId: wallet._id.toString(),
        currency: wallet.currency,
        walletType: wallet.walletType,
        name: wallet.name,
        balance: wallet.balance,
        status: wallet.status,
        createdAt: wallet.createdAt
      }));
    } catch (error) {
      logger.error(`Get user wallets error: ${error.message}`);
      throw new WalletError('Failed to get user wallets', 'RETRIEVAL_FAILED');
    }
  }
  
  /**
   * Update wallet status
   * @param {string} walletId - Wallet ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated wallet
   */
  async updateWalletStatus(walletId, status) {
    try {
      const wallet = await Wallet.findById(walletId);
      
      if (!wallet) {
        throw new WalletError('Wallet not found', 'NOT_FOUND');
      }
      
      // Update status
      wallet.status = status;
      await wallet.save();
      
      // Publish wallet updated event
      await publishEvent('wallet.updated', {
        walletId: wallet._id.toString(),
        userId: wallet.userId.toString(),
        status
      });
      
      logger.info(`Wallet status updated: ${walletId} to ${status}`);
      
      return {
        walletId: wallet._id.toString(),
        status: wallet.status,
        updatedAt: wallet.updatedAt
      };
    } catch (error) {
      if (error instanceof WalletError) {
        throw error;
      }
      
      logger.error(`Update wallet status error: ${error.message}`);
      throw new WalletError('Failed to update wallet status', 'UPDATE_FAILED');
    }
  }
}

module.exports = new WalletService();
```

### 8. Validation Utility

```javascript
// transaction-service/src/validation/transaction.validation.js

const Joi = require('joi');

/**
 * Validate transaction request
 */
exports.validateTransactionRequest = (data) => {
  const schema = Joi.object({
    transactionType: Joi.string()
      .valid('generation', 'transfer', 'cash_out', 'refund')
      .required()
      .messages({
        'string.base': 'Transaction type must be a string',
        'any.only': 'Transaction type must be one of: generation, transfer, cash_out, refund',
        'any.required': 'Transaction type is required'
      }),
    
    sourceType: Joi.string()
      .valid('wallet', 'system', 'external')
      .required()
      .messages({
        'string.base': 'Source type must be a string',
        'any.only': 'Source type must be one of: wallet, system, external',
        'any.required': 'Source type is required'
      }),
    
    sourceId: Joi.string()
      .required()
      .messages({
        'string.base': 'Source ID must be a string',
        'any.required': 'Source ID is required'
      }),
    
    destinationType: Joi.string()
      .valid('wallet', 'external')
      .required()
      .messages({
        'string.base': 'Destination type must be a string',
        'any.only': 'Destination type must be one of: wallet, external',
        'any.required': 'Destination type is required'
      }),
    
    destinationId: Joi.string()
      .required()
      .messages({
        'string.base': 'Destination ID must be a string',
        'any.required': 'Destination ID is required'
      }),
    
    userId: Joi.string()
      .optional()
      .messages({
        'string.base': 'User ID must be a string'
      }),
    
    amount: Joi.number()
      .positive()
      .required()
      .messages({
        'number.base': 'Amount must be a number',
        'number.positive': 'Amount must be positive',
        'any.required': 'Amount is required'
      }),
    
    currency: Joi.string()
      .required()
      .messages({
        'string.base': 'Currency must be a string',
        'any.required': 'Currency is required'
      }),
    
    fee: Joi.number()
      .min(0)
      .default(0)
      .messages({
        'number.base': 'Fee must be a number',
        'number.min': 'Fee cannot be negative'
      }),
    
    description: Joi.string()
      .optional()
      .messages({
        'string.base': 'Description must be a string'
      }),
    
    reference: Joi.string()
      .optional()
      .messages({
        'string.base': 'Reference must be a string'
      }),
    
    metadata: Joi.object()
      .optional()
  });
  
  return schema.validate(data);
};

/**
 * Validate wallet request
 */
exports.validateWalletRequest = (data) => {
  const schema = Joi.object({
    userId: Joi.string()
      .optional()
      .messages({
        'string.base': 'User ID must be a string'
      }),
    
    currency: Joi.string()
      .default('USD')
      .messages({
        'string.base': 'Currency must be a string'
      }),
    
    walletType: Joi.string()
      .valid('personal', 'business', 'savings')
      .default('personal')
      .messages({
        'string.base': 'Wallet type must be a string',
        'any.only': 'Wallet type must be one of: personal, business, savings'
      }),
    
    name: Joi.string()
      .default('Default Wallet')
      .messages({
        'string.base': 'Name must be a string'
      }),
    
    metadata: Joi.object()
      .optional()
  });
  
  return schema.validate(data);
};
```

### 9. Error Utility

```javascript
// transaction-service/src/utils/errors.util.js

/**
 * Custom error for transaction-related issues
 */
class TransactionError extends Error {
  /**
   * Create a new TransactionError
   * @param {string} message - Error message
   * @param {string} code - Error code
   */
  constructor(message, code) {
    super(message);
    this.name = 'TransactionError';
    this.code = code;
  }
}

/**
 * Custom error for wallet-related issues
 */
class WalletError extends Error {
  /**
   * Create a new WalletError
   * @param {string} message - Error message
   * @param {string} code - Error code
   */
  constructor(message, code) {
    super(message);
    this.name = 'WalletError';
    this.code = code;
  }
}

module.exports = {
  TransactionError,
  WalletError
};
```

### 10. Main Server File

```javascript
// transaction-service/src/server.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { redisClient } = require('./config/redis.config');
const { subscribeToEvents } = require('./utils/event.util');
const logger = require('./utils/logger.util');
const transactionRoutes = require('./routes/transaction.routes');
const walletRoutes = require('./routes/wallet.routes');

// Environment variables
const {
  PORT = 3003,
  MONGODB_URI,
  NODE_ENV = 'development'
} = process.env;

// Create Express app
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Routes
app.use('/api/transactions', transactionRoutes);
app.use('/api/wallets', walletRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'transaction-service',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred'
    }
  });
});

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    logger.info('Connected to MongoDB');
    
    // Subscribe to events
    subscribeToEvents('generation.completed', handleGenerationCompleted);
    subscribeToEvents('cash_out.initiated', handleCashOutInitiated);
    subscribeToEvents('cash_out.completed', handleCashOutCompleted);
    subscribeToEvents('cash_out.failed', handleCashOutFailed);
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`Transaction service running on port ${PORT}`);
    });
  })
  .catch((error) => {
    logger.error(`Server initialization error: ${error.message}`);
    process.exit(1);
  });

// Event handlers
function handleGenerationCompleted(data) {
  logger.info(`Generation completed event received: ${data.generationId}`);
  // Handle generation completed event
}

function handleCashOutInitiated(data) {
  logger.info(`Cash out initiated event received: ${data.cashOutId}`);
  // Handle cash out initiated event
}

function handleCashOutCompleted(data) {
  logger.info(`Cash out completed event received: ${data.cashOutId}`);
  // Handle cash out completed event
}

function handleCashOutFailed(data) {
  logger.info(`Cash out failed event received: ${data.cashOutId}`);
  // Handle cash out failed event
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});

// Handle SIGTERM
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Close MongoDB connection
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
  
  // Close Redis connection
  await redisClient.quit();
  logger.info('Redis connection closed');
  
  process.exit(0);
});
```

## Transaction Processing Flow

The transaction processing system handles different types of transactions with specific flows:

### 1. Generation Transaction Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Money          │     │  Transaction    │     │  Wallet         │
│  Generation     │────▶│  Service        │────▶│  Service        │
│  Service        │     │                 │     │                 │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │                 │
                        │  Event          │
                        │  Publisher      │
                        │                 │
                        └─────────────────┘
```

1. Money Generation Service initiates a generation transaction
2. Transaction Service processes the transaction:
   - Creates a transaction record
   - Updates the destination wallet balance
   - Marks the transaction as completed
3. Event Publisher sends a transaction.completed event
4. Other services can subscribe to this event for further processing

### 2. Transfer Transaction Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  API            │     │  Transaction    │     │  Wallet         │
│  Gateway        │────▶│  Service        │────▶│  Service        │
│                 │     │                 │     │                 │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │                 │
                        │  Event          │
                        │  Publisher      │
                        │                 │
                        └─────────────────┘
```

1. User initiates a transfer transaction through the API Gateway
2. Transaction Service processes the transaction:
   - Validates the source and destination wallets
   - Checks if the source wallet has sufficient balance
   - Deducts the amount from the source wallet
   - Adds the amount to the destination wallet
   - Marks the transaction as completed
3. Event Publisher sends a transaction.completed event
4. Other services can subscribe to this event for further processing

### 3. Cash Out Transaction Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  API            │     │  Transaction    │     │  Wallet         │
│  Gateway        │────▶│  Service        │────▶│  Service        │
│                 │     │                 │     │                 │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │                 │     │                 │
                        │  Event          │────▶│  Payment        │
                        │  Publisher      │     │  Integration    │
                        │                 │     │  Service        │
                        └─────────────────┘     └─────────────────┘
```

1. User initiates a cash out transaction through the API Gateway
2. Transaction Service processes the transaction:
   - Validates the source wallet
   - Checks if the wallet has sufficient balance
   - Deducts the amount from the wallet
   - Marks the transaction as pending
3. Event Publisher sends a cash_out.initiated event
4. Payment Integration Service receives the event and processes the cash out:
   - Calls the external payment provider API
   - Updates the transaction status based on the provider response
   - Sends a cash_out.completed or cash_out.failed event
5. Transaction Service receives the event and updates the transaction status

### 4. Refund Transaction Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Admin          │     │  Transaction    │     │  Wallet         │
│  Dashboard      │────▶│  Service        │────▶│  Service        │
│                 │     │                 │     │                 │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │                 │
                        │  Event          │
                        │  Publisher      │
                        │                 │
                        └─────────────────┘
```

1. Admin initiates a refund transaction through the Admin Dashboard
2. Transaction Service processes the transaction:
   - Validates the original transaction
   - Adds the refund amount to the destination wallet
   - Marks the transaction as completed
3. Event Publisher sends a transaction.completed event
4. Other services can subscribe to this event for further processing

## Transaction Security Measures

The transaction processing system implements several security measures to ensure the integrity and safety of transactions:

### 1. Transaction Validation

```javascript
/**
 * Validate transaction data
 * @param {Object} data - Transaction data
 * @throws {TransactionError} If validation fails
 * @private
 */
function validateTransaction(data) {
  // Validate required fields
  const requiredFields = [
    'transactionType',
    'sourceType',
    'sourceId',
    'destinationType',
    'destinationId',
    'userId',
    'amount',
    'currency'
  ];
  
  for (const field of requiredFields) {
    if (!data[field]) {
      throw new TransactionError(`Missing required field: ${field}`, 'MISSING_FIELD');
    }
  }
  
  // Validate amount
  if (typeof data.amount !== 'number' || data.amount <= 0) {
    throw new TransactionError('Amount must be a positive number', 'INVALID_AMOUNT');
  }
  
  // Validate fee
  if (data.fee && (typeof data.fee !== 'number' || data.fee < 0)) {
    throw new TransactionError('Fee must be a non-negative number', 'INVALID_FEE');
  }
  
  // Validate transaction type
  const validTransactionTypes = ['generation', 'transfer', 'cash_out', 'refund'];
  if (!validTransactionTypes.includes(data.transactionType)) {
    throw new TransactionError(`Invalid transaction type: ${data.transactionType}`, 'INVALID_TYPE');
  }
  
  // Validate source type
  const validSourceTypes = ['wallet', 'system', 'external'];
  if (!validSourceTypes.includes(data.sourceType)) {
    throw new TransactionError(`Invalid source type: ${data.sourceType}`, 'INVALID_SOURCE_TYPE');
  }
  
  // Validate destination type
  const validDestinationTypes = ['wallet', 'external'];
  if (!validDestinationTypes.includes(data.destinationType)) {
    throw new TransactionError(`Invalid destination type: ${data.destinationType}`, 'INVALID_DESTINATION_TYPE');
  }
  
  // Validate transaction-specific rules
  switch (data.transactionType) {
    case 'transfer':
      if (data.sourceType !== 'wallet' || data.destinationType !== 'wallet') {
        throw new TransactionError('Transfer must be between wallets', 'INVALID_TRANSFER_TYPE');
      }
      break;
    
    case 'cash_out':
      if (data.sourceType !== 'wallet' || data.destinationType !== 'external') {
        throw new TransactionError('Cash out must be from wallet to external destination', 'INVALID_CASH_OUT_TYPE');
      }
      break;
    
    case 'generation':
      if (data.sourceType !== 'system' || data.destinationType !== 'wallet') {
        throw new TransactionError('Generation must be from system to wallet', 'INVALID_GENERATION_TYPE');
      }
      break;
    
    case 'refund':
      if (data.destinationType !== 'wallet') {
        throw new TransactionError('Refund destination must be a wallet', 'INVALID_DESTINATION');
      }
      break;
  }
}
```

### 2. Transaction Locking

```javascript
/**
 * Process a transaction with locking to prevent race conditions
 * @param {Object} transactionData - Transaction data
 * @returns {Promise<Object>} Processed transaction
 */
async function processTransactionWithLocking(transactionData) {
  // Generate a unique lock key based on the wallets involved
  const lockKeys = [];
  
  if (transactionData.sourceType === 'wallet') {
    lockKeys.push(`wallet:${transactionData.sourceId}`);
  }
  
  if (transactionData.destinationType === 'wallet') {
    lockKeys.push(`wallet:${transactionData.destinationId}`);
  }
  
  // Sort lock keys to prevent deadlocks
  lockKeys.sort();
  
  // Acquire locks
  const lockIds = [];
  try {
    for (const key of lockKeys) {
      const lockId = await acquireLock(key, 30); // 30 seconds timeout
      lockIds.push({ key, id: lockId });
    }
    
    // Process transaction
    const result = await processTransaction(transactionData);
    
    return result;
  } finally {
    // Release locks in reverse order
    for (let i = lockIds.length - 1; i >= 0; i--) {
      await releaseLock(lockIds[i].key, lockIds[i].id);
    }
  }
}

/**
 * Acquire a distributed lock using Redis
 * @param {string} key - Lock key
 * @param {number} timeoutSeconds - Lock timeout in seconds
 * @returns {Promise<string>} Lock ID
 */
async function acquireLock(key, timeoutSeconds) {
  const lockId = uuidv4();
  const result = await redisClient.set(
    `lock:${key}`,
    lockId,
    'NX',
    'EX',
    timeoutSeconds
  );
  
  if (!result) {
    throw new TransactionError('Failed to acquire lock, please try again later', 'LOCK_ACQUISITION_FAILED');
  }
  
  return lockId;
}

/**
 * Release a distributed lock
 * @param {string} key - Lock key
 * @param {string} lockId - Lock ID
 * @returns {Promise<boolean>} Success status
 */
async function releaseLock(key, lockId) {
  // Use Lua script to ensure atomic release
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  
  const result = await redisClient.eval(
    script,
    1,
    `lock:${key}`,
    lockId
  );
  
  return result === 1;
}
```

### 3. Transaction Idempotency

```javascript
/**
 * Process a transaction with idempotency
 * @param {Object} transactionData - Transaction data
 * @returns {Promise<Object>} Processed transaction
 */
async function processTransactionWithIdempotency(transactionData) {
  // Check if idempotency key is provided
  const idempotencyKey = transactionData.idempotencyKey || transactionData.reference;
  
  if (!idempotencyKey) {
    throw new TransactionError('Idempotency key or reference is required', 'MISSING_IDEMPOTENCY_KEY');
  }
  
  // Check if transaction with this idempotency key already exists
  const existingTransaction = await Transaction.findOne({
    $or: [
      { reference: idempotencyKey },
      { 'metadata.idempotencyKey': idempotencyKey }
    ]
  });
  
  if (existingTransaction) {
    // Return the existing transaction result
    return {
      transactionId: existingTransaction._id.toString(),
      reference: existingTransaction.reference,
      status: existingTransaction.status,
      amount: existingTransaction.amount,
      currency: existingTransaction.currency,
      fee: existingTransaction.fee,
      transactionType: existingTransaction.transactionType,
      createdAt: existingTransaction.createdAt,
      completedAt: existingTransaction.completedAt,
      isExisting: true
    };
  }
  
  // Store idempotency key in metadata
  if (!transactionData.metadata) {
    transactionData.metadata = {};
  }
  
  if (idempotencyKey !== transactionData.reference) {
    transactionData.metadata.idempotencyKey = idempotencyKey;
  }
  
  // Process the transaction
  const result = await processTransaction(transactionData);
  
  return result;
}
```

### 4. Transaction Audit Trail

```javascript
/**
 * Create an audit trail for a transaction
 * @param {Object} transaction - Transaction object
 * @param {string} action - Action performed
 * @param {Object} details - Additional details
 * @returns {Promise<Object>} Audit record
 */
async function createTransactionAudit(transaction, action, details = {}) {
  const audit = new TransactionAudit({
    transactionId: transaction._id,
    userId: transaction.userId,
    action,
    status: transaction.status,
    details,
    ipAddress: details.ipAddress || 'system',
    userAgent: details.userAgent || 'system'
  });
  
  await audit.save();
  
  return {
    auditId: audit._id.toString(),
    action,
    timestamp: audit.createdAt
  };
}

/**
 * Get audit trail for a transaction
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<Array>} Audit records
 */
async function getTransactionAuditTrail(transactionId) {
  const audits = await TransactionAudit.find({ transactionId })
    .sort({ createdAt: 1 });
  
  return audits.map(audit => ({
    auditId: audit._id.toString(),
    action: audit.action,
    status: audit.status,
    details: audit.details,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
    timestamp: audit.createdAt
  }));
}
```

## Conclusion

The transaction processing system is a critical component of the Digital Money Generation System, providing secure and reliable handling of all financial transactions. It includes:

1. **Transaction Service**: Processes different types of transactions (generation, transfer, cash out, refund)
2. **Wallet Service**: Manages user wallets and balances
3. **Security Measures**: Implements validation, locking, idempotency, and audit trails
4. **Event-Driven Architecture**: Uses events to communicate with other services

The system is designed to be scalable, secure, and reliable, ensuring that all transactions are processed correctly and with proper audit trails. It provides a solid foundation for the Digital Money Generation System, allowing users to generate, transfer, and cash out digital money.