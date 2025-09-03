const Generation = require('../models/Generation');
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const generationAlgorithms = require('./generationAlgorithms');
const { publishMessage } = require('../config/rabbitmq');
const { getClient: getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class GenerationService {
  constructor() {
    this.cooldownDuration = parseInt(process.env.GENERATION_COOLDOWN_MINUTES) || 30;
    this.maxRetries = 3;
  }

  // Main generation method
  async generateMoney(userId, amount, currency, algorithm, options = {}) {
    try {
      logger.generation(`Starting money generation for user ${userId}`, {
        userId,
        amount,
        currency,
        algorithm,
        options
      });

      // Validate user and wallet
      const [user, wallet] = await Promise.all([
        User.findById(userId),
        Wallet.getUserWallet(userId)
      ]);

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      if (!wallet) {
        // Create wallet if it doesn't exist
        const newWallet = await Wallet.createWallet(userId, currency);
        logger.wallet(`Created new wallet for user ${userId}`, { userId, walletId: newWallet._id });
      }

      // Check if user can generate
      const canGenerate = await this.checkGenerationEligibility(userId, amount, currency);
      if (!canGenerate.eligible) {
        throw new AppError(canGenerate.reason, 400, canGenerate.code);
      }

      // Create generation record
      const generation = new Generation({
        userId,
        walletId: wallet?._id || (await Wallet.getUserWallet(userId))._id,
        algorithm: algorithm || 'quantum',
        amount,
        currency,
        metadata: {
          userAgent: options.userAgent,
          ipAddress: options.ipAddress,
          location: options.location,
          device: options.device
        },
        limits: canGenerate.limits
      });

      await generation.save();

      // Start generation process
      const result = await this.processGeneration(generation, options);

      // Update generation record with result
      await generation.completeGeneration(result);

      // Update wallet balance
      await this.updateWalletBalance(userId, result.generatedAmount, currency, result.fees);

      // Publish success message
      await this.publishGenerationResult(generation, result, 'success');

      logger.generation(`Money generation completed successfully for user ${userId}`, {
        userId,
        generationId: generation._id,
        amount: result.generatedAmount,
        currency,
        algorithm
      });

      return {
        success: true,
        generationId: generation._id,
        amount: result.generatedAmount,
        currency,
        algorithm,
        transactionHash: result.transactionHash,
        fees: result.fees,
        netAmount: result.netAmount
      };

    } catch (error) {
      logger.error('Money generation failed:', error);
      
      // Update generation record if it exists
      if (error.generationId) {
        await Generation.findByIdAndUpdate(error.generationId, {
          status: 'failed',
          result: { error: error.message }
        });
      }

      throw error;
    }
  }

  // Check if user is eligible for generation
  async checkGenerationEligibility(userId, amount, currency) {
    try {
      // Check user status
      const user = await User.findById(userId);
      if (!user || user.status !== 'active') {
        return {
          eligible: false,
          reason: 'User account is not active',
          code: 'USER_INACTIVE'
        };
      }

      // Check if user is verified
      if (!user.isVerified) {
        return {
          eligible: false,
          reason: 'User account must be verified to generate money',
          code: 'USER_UNVERIFIED'
        };
      }

      // Check cooldown
      const cooldownCheck = await this.checkCooldown(userId);
      if (cooldownCheck.isActive) {
        return {
          eligible: false,
          reason: `Generation cooldown active. Try again in ${Math.ceil((cooldownCheck.expiresAt - Date.now()) / 60000)} minutes`,
          code: 'COOLDOWN_ACTIVE'
        };
      }

      // Check daily and monthly limits
      const limits = await this.calculateRemainingLimits(userId, currency);
      if (amount > limits.remainingDaily) {
        return {
          eligible: false,
          reason: `Amount exceeds daily limit. Remaining: ${limits.remainingDaily}`,
          code: 'DAILY_LIMIT_EXCEEDED'
        };
      }

      if (amount > limits.remainingMonthly) {
        return {
          eligible: false,
          reason: `Amount exceeds monthly limit. Remaining: ${limits.remainingMonthly}`,
          code: 'MONTHLY_LIMIT_EXCEEDED'
        };
      }

      if (amount > limits.remainingYearly) {
        return {
          eligible: false,
          reason: `Amount exceeds yearly limit. Remaining: ${limits.remainingYearly}`,
          code: 'YEARLY_LIMIT_EXCEEDED'
        };
      }

      return {
        eligible: true,
        limits
      };

    } catch (error) {
      logger.error('Error checking generation eligibility:', error);
      throw error;
    }
  }

  // Check if user is in cooldown
  async checkCooldown(userId) {
    try {
      const redisClient = getRedisClient();
      const cooldownKey = `cooldown:${userId}`;
      
      const cooldownData = await redisClient.get(cooldownKey);
      if (cooldownData) {
        const { expiresAt, reason } = JSON.parse(cooldownData);
        if (Date.now() < expiresAt) {
          return {
            isActive: true,
            expiresAt,
            reason
          };
        } else {
          // Remove expired cooldown
          await redisClient.del(cooldownKey);
        }
      }

      return { isActive: false };
    } catch (error) {
      logger.error('Error checking cooldown:', error);
      return { isActive: false };
    }
  }

  // Calculate remaining generation limits
  async calculateRemainingLimits(userId, currency) {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      // Get user's generation stats
      const [dailyStats, monthlyStats, yearlyStats] = await Promise.all([
        Generation.aggregate([
          {
            $match: {
              userId: userId,
              currency: currency,
              status: 'completed',
              createdAt: { $gte: startOfDay }
            }
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: '$result.generatedAmount' }
            }
          }
        ]),
        Generation.aggregate([
          {
            $match: {
              userId: userId,
              currency: currency,
              status: 'completed',
              createdAt: { $gte: startOfMonth }
            }
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: '$result.generatedAmount' }
            }
          }
        ]),
        Generation.aggregate([
          {
            $match: {
              userId: userId,
              currency: currency,
              status: 'completed',
              createdAt: { $gte: startOfYear }
            }
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: '$result.generatedAmount' }
            }
          }
        ])
      ]);

      const dailyUsed = dailyStats[0]?.totalAmount || 0;
      const monthlyUsed = monthlyStats[0]?.totalAmount || 0;
      const yearlyUsed = yearlyStats[0]?.totalAmount || 0;

      const dailyLimit = parseInt(process.env.GENERATION_LIMIT_DAILY) || 1000;
      const monthlyLimit = parseInt(process.env.GENERATION_LIMIT_MONTHLY) || 10000;
      const yearlyLimit = parseInt(process.env.GENERATION_LIMIT_YEARLY) || 100000;

      return {
        dailyLimit,
        monthlyLimit,
        yearlyLimit,
        remainingDaily: Math.max(0, dailyLimit - dailyUsed),
        remainingMonthly: Math.max(0, monthlyLimit - monthlyUsed),
        remainingYearly: Math.max(0, yearlyLimit - yearlyUsed)
      };

    } catch (error) {
      logger.error('Error calculating remaining limits:', error);
      throw error;
    }
  }

  // Process the actual generation
  async processGeneration(generation, options = {}) {
    try {
      // Start processing
      await generation.startProcessing();

      // Generate seed
      const seed = this.generateSeed(generation.userId, generation.amount, generation.currency);

      // Select and run algorithm
      const algorithm = generation.algorithm || 'quantum';
      let result;

      switch (algorithm) {
        case 'quantum':
          result = await generationAlgorithms.quantumAlgorithm(seed, generation.amount, generation.currency);
          break;
        case 'cryptographic':
          result = await generationAlgorithms.cryptographicAlgorithm(seed, generation.amount, generation.currency);
          break;
        case 'mathematical':
          result = await generationAlgorithms.mathematicalAlgorithm(seed, generation.amount, generation.currency);
          break;
        case 'hybrid':
          result = await generationAlgorithms.hybridAlgorithm(seed, generation.amount, generation.currency);
          break;
        default:
          throw new AppError(`Unknown algorithm: ${algorithm}`, 400, 'INVALID_ALGORITHM');
      }

      // Validate result
      if (!generationAlgorithms.validateResult(result)) {
        throw new AppError('Algorithm validation failed', 500, 'ALGORITHM_VALIDATION_FAILED');
      }

      // Calculate fees and net amount
      const fees = this.calculateFees(generation.amount, generation.currency, algorithm);
      const netAmount = generation.amount - fees;

      // Generate transaction hash
      const transactionHash = this.generateTransactionHash(result.hash, generation.userId, generation.amount);

      return {
        generatedAmount: generation.amount,
        transactionHash,
        blockNumber: Date.now(),
        timestamp: new Date(),
        fees,
        netAmount,
        algorithm: result.algorithm,
        seed: result.seed,
        nonce: result.nonce,
        hash: result.hash,
        proof: result.proof,
        difficulty: result.difficulty,
        iterations: result.iterations,
        processingTime: result.processingTime
      };

    } catch (error) {
      logger.error('Error processing generation:', error);
      throw error;
    }
  }

  // Update wallet balance after successful generation
  async updateWalletBalance(userId, amount, currency, fees) {
    try {
      const wallet = await Wallet.getUserWallet(userId);
      if (!wallet) {
        throw new AppError('Wallet not found', 404, 'WALLET_NOT_FOUND');
      }

      // Record generation in wallet
      await wallet.recordGeneration(amount, currency, fees);

      logger.wallet(`Wallet balance updated for user ${userId}`, {
        userId,
        amount,
        currency,
        fees,
        newBalance: wallet.getBalance(currency)
      });

      return wallet;
    } catch (error) {
      logger.error('Error updating wallet balance:', error);
      throw error;
    }
  }

  // Publish generation result to message queue
  async publishGenerationResult(generation, result, status) {
    try {
      const message = {
        generationId: generation._id,
        userId: generation.userId,
        walletId: generation.walletId,
        status,
        result,
        timestamp: new Date().toISOString()
      };

      await publishMessage('money.generation', 'result', message);
      
      logger.info(`Generation result published to queue`, {
        generationId: generation._id,
        status
      });

    } catch (error) {
      logger.error('Error publishing generation result:', error);
      // Don't throw error as this is not critical
    }
  }

  // Helper methods
  generateSeed(userId, amount, currency) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    const data = `${userId}:${amount}:${currency}:${timestamp}:${random}`;
    return require('crypto').createHash('sha256').update(data).digest('hex');
  }

  calculateFees(amount, currency, algorithm) {
    // Base fee structure
    let feeRate = 0.01; // 1% base fee

    // Adjust fee based on algorithm complexity
    switch (algorithm) {
      case 'hybrid':
        feeRate = 0.015; // 1.5% for hybrid
        break;
      case 'quantum':
        feeRate = 0.012; // 1.2% for quantum
        break;
      case 'cryptographic':
        feeRate = 0.01; // 1% for cryptographic
        break;
      case 'mathematical':
        feeRate = 0.008; // 0.8% for mathematical
        break;
    }

    // Adjust fee based on amount (higher amounts get lower fees)
    if (amount > 10000) {
      feeRate *= 0.8;
    } else if (amount > 1000) {
      feeRate *= 0.9;
    }

    const fees = amount * feeRate;
    return Math.round(fees * 100) / 100; // Round to 2 decimal places
  }

  generateTransactionHash(hash, userId, amount) {
    const data = `${hash}:${userId}:${amount}:${Date.now()}`;
    return require('crypto').createHash('sha256').update(data).digest('hex');
  }

  // Get generation history for user
  async getUserGenerations(userId, options = {}) {
    try {
      const { page = 1, limit = 20, status, algorithm, currency, startDate, endDate } = options;
      
      const query = { userId };
      
      if (status) query.status = status;
      if (algorithm) query.algorithm = algorithm;
      if (currency) query.currency = currency;
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const skip = (page - 1) * limit;
      
      const [generations, total] = await Promise.all([
        Generation.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('walletId', 'walletAddress'),
        Generation.countDocuments(query)
      ]);

      return {
        generations,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      logger.error('Error getting user generations:', error);
      throw error;
    }
  }

  // Get generation statistics
  async getGenerationStats(userId, period = 'month') {
    try {
      const stats = await Generation.getUserStats(userId, period);
      return stats[0] || { totalAmount: 0, totalFees: 0, totalNetAmount: 0, count: 0 };
    } catch (error) {
      logger.error('Error getting generation stats:', error);
      throw error;
    }
  }

  // Cancel pending generation
  async cancelGeneration(generationId, userId) {
    try {
      const generation = await Generation.findById(generationId);
      
      if (!generation) {
        throw new AppError('Generation not found', 404, 'GENERATION_NOT_FOUND');
      }

      if (generation.userId.toString() !== userId) {
        throw new AppError('Access denied to this generation', 403, 'ACCESS_DENIED');
      }

      if (generation.status !== 'pending') {
        throw new AppError('Only pending generations can be cancelled', 400, 'INVALID_STATUS');
      }

      generation.status = 'cancelled';
      await generation.save();

      logger.generation(`Generation cancelled by user ${userId}`, {
        generationId,
        userId
      });

      return { success: true, message: 'Generation cancelled successfully' };

    } catch (error) {
      logger.error('Error cancelling generation:', error);
      throw error;
    }
  }
}

module.exports = new GenerationService();
