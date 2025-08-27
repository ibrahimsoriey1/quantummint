const mongoose = require('mongoose');
const crypto = require('crypto');
const GenerationRecord = require('../models/generation.model');
const Wallet = require('../models/wallet.model');
const Transaction = require('../models/transaction.model');
const { redisClient } = require('../config/redis.config');
const { publishEvent } = require('../utils/event.util');
const logger = require('../utils/logger.util');
const { GenerationError } = require('../utils/errors.util');

/**
 * Money Generation Service
 * Handles the core functionality of generating digital money
 */
class MoneyGenerationService {
  /**
   * Generate money in a user's wallet
   * @param {string} userId - User ID
   * @param {string} walletId - Wallet ID
   * @param {number} amount - Amount to generate
   * @param {string} generationMethod - Method of generation (standard, accelerated, premium)
   * @param {Object} metadata - Additional metadata for the generation
   * @returns {Promise<Object>} Generation record
   */
  async generateMoney(userId, walletId, amount, generationMethod, metadata = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Validate inputs
      if (!userId || !walletId || !amount || !generationMethod) {
        throw new GenerationError('Missing required parameters', 'INVALID_PARAMETERS');
      }
      
      if (amount <= 0) {
        throw new GenerationError('Amount must be greater than zero', 'INVALID_AMOUNT');
      }
      
      // Get wallet
      const wallet = await Wallet.findOne({ _id: walletId, userId }).session(session);
      
      if (!wallet) {
        throw new GenerationError('Wallet not found', 'WALLET_NOT_FOUND');
      }
      
      if (wallet.status !== 'active') {
        throw new GenerationError(`Wallet is ${wallet.status}`, 'WALLET_INACTIVE');
      }
      
      // Check generation limits
      await this._checkGenerationLimits(wallet, amount, session);
      
      // Create generation record
      const generationId = new mongoose.Types.ObjectId();
      const generationRecord = new GenerationRecord({
        _id: generationId,
        userId,
        walletId,
        amount,
        currency: wallet.currency,
        generationMethod,
        generationParams: this._getGenerationParams(generationMethod, amount),
        status: 'pending',
        metadata
      });
      
      await generationRecord.save({ session });
      
      // Generate verification code
      const verificationCode = this._generateVerificationCode();
      
      // Store verification code in Redis with 10-minute expiry
      await redisClient.set(
        `generation_verification:${generationId.toString()}`,
        verificationCode,
        'EX',
        600
      );
      
      // Publish event for verification
      await publishEvent('generation.verification_required', {
        generationId: generationId.toString(),
        userId,
        walletId,
        amount,
        currency: wallet.currency,
        generationMethod,
        verificationCode
      });
      
      // Update wallet generation limits
      wallet.dailyGenerated += amount;
      wallet.monthlyGenerated += amount;
      wallet.totalGenerated += amount;
      wallet.lastGenerationDate = new Date();
      
      await wallet.save({ session });
      
      await session.commitTransaction();
      
      logger.info(`Money generation initiated: ${amount} ${wallet.currency} for wallet ${walletId}`);
      
      return {
        generationId: generationId.toString(),
        walletId,
        amount,
        currency: wallet.currency,
        status: 'pending',
        createdAt: generationRecord.createdAt
      };
    } catch (error) {
      await session.abortTransaction();
      
      if (error instanceof GenerationError) {
        logger.warn(`Generation error: ${error.message} (${error.code})`);
        throw error;
      }
      
      logger.error(`Money generation error: ${error.message}`);
      throw new GenerationError('Failed to generate money', 'GENERATION_FAILED');
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Verify a generation request
   * @param {string} generationId - Generation record ID
   * @param {string} verificationCode - Verification code
   * @returns {Promise<Object>} Updated generation record
   */
  async verifyGeneration(generationId, verificationCode) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Get generation record
      const generationRecord = await GenerationRecord.findById(generationId).session(session);
      
      if (!generationRecord) {
        throw new GenerationError('Generation record not found', 'RECORD_NOT_FOUND');
      }
      
      if (generationRecord.status !== 'pending') {
        throw new GenerationError(`Generation is already ${generationRecord.status}`, 'INVALID_STATUS');
      }
      
      // Get stored verification code
      const storedCode = await redisClient.get(`generation_verification:${generationId}`);
      
      if (!storedCode) {
        throw new GenerationError('Verification code expired', 'CODE_EXPIRED');
      }
      
      // Verify code
      if (verificationCode !== storedCode) {
        throw new GenerationError('Invalid verification code', 'INVALID_CODE');
      }
      
      // Get wallet
      const wallet = await Wallet.findById(generationRecord.walletId).session(session);
      
      if (!wallet) {
        throw new GenerationError('Wallet not found', 'WALLET_NOT_FOUND');
      }
      
      // Update generation record
      generationRecord.status = 'completed';
      generationRecord.verificationStatus = 'verified';
      generationRecord.verifiedAt = new Date();
      
      await generationRecord.save({ session });
      
      // Update wallet balance
      wallet.balance += generationRecord.amount;
      await wallet.save({ session });
      
      // Create transaction record
      const transaction = new Transaction({
        transactionType: 'generation',
        destinationWalletId: wallet._id,
        amount: generationRecord.amount,
        currency: wallet.currency,
        status: 'completed',
        description: `Money generation (${generationRecord.generationMethod})`,
        reference: generationRecord._id.toString(),
        metadata: {
          generationMethod: generationRecord.generationMethod,
          generationParams: generationRecord.generationParams
        },
        completedAt: new Date()
      });
      
      await transaction.save({ session });
      
      // Delete verification code from Redis
      await redisClient.del(`generation_verification:${generationId}`);
      
      // Publish generation completed event
      await publishEvent('generation.completed', {
        generationId: generationRecord._id.toString(),
        userId: generationRecord.userId.toString(),
        walletId: wallet._id.toString(),
        amount: generationRecord.amount,
        currency: wallet.currency,
        generationMethod: generationRecord.generationMethod,
        transactionId: transaction._id.toString()
      });
      
      await session.commitTransaction();
      
      logger.info(`Money generation completed: ${generationRecord.amount} ${wallet.currency} for wallet ${wallet._id}`);
      
      return {
        generationId: generationRecord._id.toString(),
        walletId: wallet._id.toString(),
        amount: generationRecord.amount,
        currency: wallet.currency,
        status: 'completed',
        createdAt: generationRecord.createdAt,
        completedAt: generationRecord.verifiedAt
      };
    } catch (error) {
      await session.abortTransaction();
      
      if (error instanceof GenerationError) {
        logger.warn(`Generation verification error: ${error.message} (${error.code})`);
        throw error;
      }
      
      logger.error(`Money generation verification error: ${error.message}`);
      throw new GenerationError('Failed to verify generation', 'VERIFICATION_FAILED');
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Get generation status
   * @param {string} generationId - Generation record ID
   * @returns {Promise<Object>} Generation record
   */
  async getGenerationStatus(generationId) {
    try {
      const generationRecord = await GenerationRecord.findById(generationId);
      
      if (!generationRecord) {
        throw new GenerationError('Generation record not found', 'RECORD_NOT_FOUND');
      }
      
      return {
        generationId: generationRecord._id.toString(),
        walletId: generationRecord.walletId.toString(),
        amount: generationRecord.amount,
        currency: generationRecord.currency,
        generationMethod: generationRecord.generationMethod,
        status: generationRecord.status,
        verificationStatus: generationRecord.verificationStatus,
        createdAt: generationRecord.createdAt,
        updatedAt: generationRecord.updatedAt,
        completedAt: generationRecord.verifiedAt
      };
    } catch (error) {
      if (error instanceof GenerationError) {
        throw error;
      }
      
      logger.error(`Get generation status error: ${error.message}`);
      throw new GenerationError('Failed to get generation status', 'STATUS_RETRIEVAL_FAILED');
    }
  }
  
  /**
   * Get generation history for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Generation history with pagination
   */
  async getGenerationHistory(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        startDate,
        endDate,
        walletId
      } = options;
      
      const query = { userId };
      
      if (status) {
        query.status = status;
      }
      
      if (walletId) {
        query.walletId = walletId;
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
      
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const [generations, total] = await Promise.all([
        GenerationRecord.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        GenerationRecord.countDocuments(query)
      ]);
      
      const formattedGenerations = generations.map(generation => ({
        generationId: generation._id.toString(),
        walletId: generation.walletId.toString(),
        amount: generation.amount,
        currency: generation.currency,
        generationMethod: generation.generationMethod,
        status: generation.status,
        createdAt: generation.createdAt,
        completedAt: generation.verifiedAt
      }));
      
      return {
        generations: formattedGenerations,
        pagination: {
          totalItems: total,
          totalPages: Math.ceil(total / parseInt(limit)),
          currentPage: parseInt(page),
          itemsPerPage: parseInt(limit)
        }
      };
    } catch (error) {
      logger.error(`Get generation history error: ${error.message}`);
      throw new GenerationError('Failed to get generation history', 'HISTORY_RETRIEVAL_FAILED');
    }
  }
  
  /**
   * Check generation limits
   * @param {Object} wallet - Wallet document
   * @param {number} amount - Amount to generate
   * @param {Object} session - Mongoose session
   * @private
   */
  async _checkGenerationLimits(wallet, amount, session) {
    // Check if daily limit would be exceeded
    if (wallet.dailyGenerated + amount > wallet.dailyGenerationLimit) {
      throw new GenerationError('Daily generation limit exceeded', 'DAILY_LIMIT_EXCEEDED');
    }
    
    // Check if monthly limit would be exceeded
    if (wallet.monthlyGenerated + amount > wallet.monthlyGenerationLimit) {
      throw new GenerationError('Monthly generation limit exceeded', 'MONTHLY_LIMIT_EXCEEDED');
    }
    
    // Reset daily generated amount if it's a new day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (wallet.lastGenerationDate && new Date(wallet.lastGenerationDate) < today) {
      wallet.dailyGenerated = 0;
      await wallet.save({ session });
    }
    
    // Reset monthly generated amount if it's a new month
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);
    
    if (wallet.lastGenerationDate && new Date(wallet.lastGenerationDate) < firstDayOfMonth) {
      wallet.monthlyGenerated = 0;
      await wallet.save({ session });
    }
  }
  
  /**
   * Get generation parameters based on method
   * @param {string} generationMethod - Generation method
   * @param {number} amount - Amount to generate
   * @returns {Object} Generation parameters
   * @private
   */
  _getGenerationParams(generationMethod, amount) {
    switch (generationMethod) {
      case 'standard':
        return {
          difficulty: 'normal',
          processingTime: Math.floor(amount / 100) + 1, // 1 second per 100 units
          fee: 0
        };
      
      case 'accelerated':
        return {
          difficulty: 'medium',
          processingTime: Math.floor(amount / 200) + 1, // 1 second per 200 units
          fee: amount * 0.01 // 1% fee
        };
      
      case 'premium':
        return {
          difficulty: 'high',
          processingTime: Math.floor(amount / 500) + 1, // 1 second per 500 units
          fee: amount * 0.02 // 2% fee
        };
      
      default:
        return {
          difficulty: 'normal',
          processingTime: Math.floor(amount / 100) + 1,
          fee: 0
        };
    }
  }
  
  /**
   * Generate verification code
   * @returns {string} Verification code
   * @private
   */
  _generateVerificationCode() {
    return crypto.randomInt(100000, 999999).toString();
  }
}

module.exports = new MoneyGenerationService();