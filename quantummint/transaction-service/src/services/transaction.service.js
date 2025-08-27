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