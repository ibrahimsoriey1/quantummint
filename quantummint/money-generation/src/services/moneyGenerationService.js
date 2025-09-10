const MoneyGeneration = require('../models/MoneyGeneration');
const User = require('../models/User');
// Simple logger for now
const logger = {
  info: (msg, data) => console.log(`INFO: ${msg}`, data || ''),
  error: (msg, error) => console.error(`ERROR: ${msg}`, error || ''),
  warn: (msg, data) => console.warn(`WARN: ${msg}`, data || '')
};

class MoneyGenerationService {
  // Amount limits
  static MIN_AMOUNT = 50;
  static MAX_AMOUNT = 100000;

  async createGenerationRequest(requestData) {
    try {
      const { userId, amount, complexity, description } = requestData;

      // Validate amount
      if (amount < MoneyGenerationService.MIN_AMOUNT || amount > MoneyGenerationService.MAX_AMOUNT) {
        throw new Error(`Amount must be between ${MoneyGenerationService.MIN_AMOUNT} and ${MoneyGenerationService.MAX_AMOUNT}`);
      }

      // Get user and validate KYC status
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.kycStatus !== 'verified') {
        throw new Error('KYC verification required');
      }

      // Validate generation limits
      const limitValidation = await this.validateGenerationLimits(userId, amount, user);
      if (!limitValidation.canGenerate) {
        throw new Error(limitValidation.reason);
      }

      // Create generation request
      const generationRequest = new MoneyGeneration({
        userId,
        amount,
        complexity: complexity || this.calculateComplexity(amount),
        description,
        status: 'pending'
      });

      await generationRequest.save();
      
      logger.info(`Generation request created: ${generationRequest.generationId}`);
      return generationRequest;
    } catch (error) {
      logger.error('Create generation request error:', error);
      throw error;
    }
  }

  async processGeneration(generationId, quantumProcessor) {
    try {
      const generation = await MoneyGeneration.findById(generationId);
      if (!generation) {
        throw new Error('Generation request not found');
      }

      // Start processing
      generation.startProcessing();
      await generation.save();

      try {
        // Process with quantum processor
        const result = await quantumProcessor.processGeneration({
          amount: generation.amount,
          complexity: generation.complexity
        });

        // Complete generation
        generation.complete(result.generatedAmount);
        await generation.save();

        logger.info(`Generation completed: ${generationId}`);
        return generation;
      } catch (processingError) {
        // Handle processing failure
        generation.fail(processingError.message);
        await generation.save();
        
        logger.error(`Generation failed: ${generationId}`, processingError);
        throw processingError;
      }
    } catch (error) {
      logger.error('Process generation error:', error);
      throw error;
    }
  }

  calculateComplexity(amount) {
    if (amount < 500) return 'low';
    if (amount < 5000) return 'medium';
    if (amount < 50000) return 'high';
    return 'extreme';
  }

  estimateProcessingTime(amount, complexity) {
    const baseTime = {
      low: 1000,     // 1 second
      medium: 5000,  // 5 seconds
      high: 15000,   // 15 seconds
      extreme: 60000 // 1 minute
    };

    const complexityTime = baseTime[complexity] || baseTime.medium;
    const amountMultiplier = Math.log10(amount) / 4;
    
    return Math.ceil(complexityTime * (1 + amountMultiplier));
  }

  async getGenerationHistory(userId, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      
      const generations = await MoneyGeneration.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await MoneyGeneration.countDocuments({ userId });
      const pages = Math.ceil(total / limit);

      return {
        generations,
        pagination: {
          page,
          limit,
          total,
          pages
        }
      };
    } catch (error) {
      logger.error('Get generation history error:', error);
      throw error;
    }
  }

  async getGenerationStats(userId) {
    try {
      const stats = await MoneyGeneration.aggregate([
        { $match: { userId: userId } },
        {
          $group: {
            _id: { status: '$status' },
            count: { $sum: 1 },
            totalAmount: { $sum: '$generatedAmount' },
            avgAmount: { $avg: '$generatedAmount' }
          }
        }
      ]);

      // Format stats
      const result = {
        completed: { count: 0, totalAmount: 0, avgAmount: 0 },
        failed: { count: 0, totalAmount: 0, avgAmount: 0 },
        pending: { count: 0, totalAmount: 0, avgAmount: 0 },
        processing: { count: 0, totalAmount: 0, avgAmount: 0 }
      };

      stats.forEach(stat => {
        const status = stat._id.status;
        if (result[status]) {
          result[status] = {
            count: stat.count,
            totalAmount: stat.totalAmount || 0,
            avgAmount: stat.avgAmount || 0
          };
        }
      });

      return result;
    } catch (error) {
      logger.error('Get generation stats error:', error);
      throw error;
    }
  }

  async validateGenerationLimits(userId, amount, user) {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get daily usage
      const dailyUsage = await MoneyGeneration.aggregate([
        {
          $match: {
            userId: userId,
            createdAt: { $gte: startOfDay },
            status: { $in: ['completed', 'processing'] }
          }
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      // Get monthly usage
      const monthlyUsage = await MoneyGeneration.aggregate([
        {
          $match: {
            userId: userId,
            createdAt: { $gte: startOfMonth },
            status: { $in: ['completed', 'processing'] }
          }
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      const dailyUsed = dailyUsage[0]?.totalAmount || 0;
      const monthlyUsed = monthlyUsage[0]?.totalAmount || 0;

      const dailyRemaining = user.dailyGenerationLimit - dailyUsed;
      const monthlyRemaining = user.monthlyGenerationLimit - monthlyUsed;

      if (amount > dailyRemaining) {
        return {
          canGenerate: false,
          reason: 'Daily generation limit exceeded',
          dailyRemaining,
          monthlyRemaining
        };
      }

      if (amount > monthlyRemaining) {
        return {
          canGenerate: false,
          reason: 'Monthly limit exceeded',
          dailyRemaining,
          monthlyRemaining
        };
      }

      return {
        canGenerate: true,
        dailyRemaining,
        monthlyRemaining
      };
    } catch (error) {
      logger.error('Validate generation limits error:', error);
      throw error;
    }
  }

  async updateGenerationStatus(generationId, status, metadata = {}) {
    try {
      const generation = await MoneyGeneration.findById(generationId);
      if (!generation) {
        throw new Error('Generation request not found');
      }

      generation.status = status;
      
      // Update metadata
      Object.keys(metadata).forEach(key => {
        generation[key] = metadata[key];
      });

      await generation.save();
      
      logger.info(`Generation status updated: ${generationId} -> ${status}`);
      return generation;
    } catch (error) {
      logger.error('Update generation status error:', error);
      throw error;
    }
  }

  async cancelGeneration(generationId) {
    try {
      const generation = await MoneyGeneration.findById(generationId);
      if (!generation) {
        throw new Error('Generation request not found');
      }

      if (generation.status === 'completed') {
        throw new Error('Cannot cancel completed generation');
      }

      if (generation.status === 'processing') {
        throw new Error('Cannot cancel generation in progress');
      }

      generation.status = 'cancelled';
      await generation.save();
      
      logger.info(`Generation cancelled: ${generationId}`);
      return generation;
    } catch (error) {
      logger.error('Cancel generation error:', error);
      throw error;
    }
  }
}

module.exports = new MoneyGenerationService();
