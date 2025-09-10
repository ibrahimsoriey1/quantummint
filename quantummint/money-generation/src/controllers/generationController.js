const Generation = require('../models/Generation');
const Wallet = require('../../../shared/models/Wallet');
const Transaction = require('../../../shared/models/Transaction');
const logger = require('../../../shared/utils/logger');
const CryptoUtils = require('../../../shared/utils/crypto');
const { asyncHandler } = require('../middleware/errorHandler');

// Generate money
const generateMoney = asyncHandler(async (req, res) => {
  const { amount, method, description } = req.body;
  const userId = req.user.id;

  // Get user's wallet
  const wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    return res.status(404).json({
      success: false,
      message: 'Wallet not found'
    });
  }

  // Check if wallet is active and not frozen
  if (!wallet.isActive || wallet.isFrozen) {
    return res.status(400).json({
      success: false,
      message: 'Wallet is inactive or frozen'
    });
  }

  // Check daily generation limits
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dailyGenerated = await Generation.aggregate([
    {
      $match: {
        userId: userId,
        status: { $in: ['completed', 'processing'] },
        createdAt: { $gte: today }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);

  const todayTotal = dailyGenerated[0]?.total || 0;
  const dailyLimit = wallet.dailyLimit || 10000;

  if (todayTotal + amount > dailyLimit) {
    return res.status(400).json({
      success: false,
      message: `Daily generation limit exceeded. Available: ${dailyLimit - todayTotal} QMC`
    });
  }

  // Create generation record
  const generation = new Generation({
    userId,
    walletId: wallet._id,
    amount,
    method,
    description,
    complexity: calculateComplexity(method, amount),
    metadata: {
      algorithm: getAlgorithm(method),
      difficulty: calculateDifficulty(method, amount),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date()
    },
    rewards: {
      baseAmount: amount,
      multiplier: getMethodMultiplier(method)
    },
    fees: calculateFees(method, amount)
  });

  // Calculate processing time and energy usage
  generation.calculateProcessingTime();
  generation.calculateEnergyUsage();

  await generation.save();

  // Start generation process
  generation.start();
  await generation.save();

  // Simulate generation process (in production, this would be a background job)
  setTimeout(async () => {
    try {
      await processGeneration(generation._id);
    } catch (error) {
      logger.error('Generation processing error', {
        generationId: generation.generationId,
        error: error.message
      });
    }
  }, generation.processingTime * 1000);

  logger.info('Money generation started', {
    userId,
    generationId: generation.generationId,
    amount,
    method,
    processingTime: generation.processingTime
  });

  res.status(201).json({
    success: true,
    message: 'Money generation started',
    data: {
      generation: {
        id: generation._id,
        generationId: generation.generationId,
        amount: generation.amount,
        method: generation.method,
        status: generation.status,
        processingTime: generation.processingTime,
        energyUsed: generation.energyUsed,
        complexity: generation.complexity,
        estimatedCompletion: new Date(Date.now() + generation.processingTime * 1000),
        fees: generation.fees
      }
    }
  });
});

// Process generation (background job simulation)
const processGeneration = async (generationId) => {
  try {
    const generation = await Generation.findById(generationId);
    if (!generation || generation.status !== 'processing') {
      return;
    }

    // Simulate generation success/failure based on method and complexity
    const successRate = getSuccessRate(generation.method, generation.complexity);
    const isSuccess = Math.random() < successRate;

    if (isSuccess) {
      // Calculate actual generated amount (with some variance)
      const variance = 0.1; // 10% variance
      const actualAmount = generation.amount * (1 + (Math.random() - 0.5) * variance);
      
      // Complete generation
      generation.complete(actualAmount);
      
      // Update wallet balance
      const wallet = await Wallet.findById(generation.walletId);
      wallet.updateBalance(actualAmount, 'generation');
      await wallet.save();

      // Create transaction record
      const transaction = new Transaction({
        toUserId: generation.userId,
        toWalletId: generation.walletId,
        amount: actualAmount,
        currency: 'QMC',
        type: 'generation',
        status: 'completed',
        description: `Money generated via ${generation.method}`,
        metadata: {
          generationMethod: generation.method,
          generationId: generation.generationId,
          ipAddress: generation.metadata.ipAddress
        },
        balances: {
          toBalanceBefore: wallet.balance - actualAmount,
          toBalanceAfter: wallet.balance
        }
      });

      transaction.markAsCompleted();
      await transaction.save();

      logger.info('Money generation completed', {
        userId: generation.userId,
        generationId: generation.generationId,
        amount: actualAmount,
        method: generation.method
      });

    } else {
      // Fail generation
      const failureReasons = [
        'Network congestion',
        'Insufficient computational resources',
        'Algorithm complexity too high',
        'Random generation failure'
      ];
      const reason = failureReasons[Math.floor(Math.random() * failureReasons.length)];
      
      generation.fail(reason);
      
      logger.warn('Money generation failed', {
        userId: generation.userId,
        generationId: generation.generationId,
        reason
      });
    }

    await generation.save();

  } catch (error) {
    logger.error('Generation processing error', {
      generationId,
      error: error.message
    });
  }
};

// Get generation history
const getGenerationHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, method, startDate, endDate } = req.query;
  const userId = req.user.id;

  const skip = (page - 1) * limit;
  const query = { userId };

  // Add filters
  if (status) query.status = status;
  if (method) query.method = method;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const generations = await Generation.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Generation.countDocuments(query);

  // Calculate statistics
  const stats = await Generation.aggregate([
    { $match: { userId, status: 'completed' } },
    {
      $group: {
        _id: null,
        totalGenerated: { $sum: '$amount' },
        totalGenerations: { $sum: 1 },
        avgAmount: { $avg: '$amount' },
        totalEnergyUsed: { $sum: '$energyUsed' }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      generations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      statistics: stats[0] || {
        totalGenerated: 0,
        totalGenerations: 0,
        avgAmount: 0,
        totalEnergyUsed: 0
      }
    }
  });
});

// Get generation by ID
const getGenerationById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const generation = await Generation.findOne({ _id: id, userId });

  if (!generation) {
    return res.status(404).json({
      success: false,
      message: 'Generation not found'
    });
  }

  res.json({
    success: true,
    data: { generation }
  });
});

// Cancel generation
const cancelGeneration = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const generation = await Generation.findOne({ _id: id, userId });

  if (!generation) {
    return res.status(404).json({
      success: false,
      message: 'Generation not found'
    });
  }

  if (generation.status !== 'pending' && generation.status !== 'processing') {
    return res.status(400).json({
      success: false,
      message: 'Cannot cancel generation in current status'
    });
  }

  generation.status = 'cancelled';
  await generation.save();

  logger.info('Generation cancelled', {
    userId,
    generationId: generation.generationId
  });

  res.json({
    success: true,
    message: 'Generation cancelled successfully'
  });
});

// Helper functions
const calculateComplexity = (method, amount) => {
  const baseComplexity = {
    quantum: 8,
    mining: 6,
    staking: 4,
    rewards: 2,
    bonus: 1
  };
  
  const amountFactor = Math.min(Math.log10(amount) / 2, 2);
  return Math.min(Math.ceil((baseComplexity[method] || 5) + amountFactor), 10);
};

const getAlgorithm = (method) => {
  const algorithms = {
    quantum: 'Quantum-SHA256',
    mining: 'Proof-of-Work',
    staking: 'Proof-of-Stake',
    rewards: 'Merit-Based',
    bonus: 'Time-Based'
  };
  return algorithms[method] || 'Standard';
};

const calculateDifficulty = (method, amount) => {
  const baseDifficulty = {
    quantum: 1000000,
    mining: 500000,
    staking: 250000,
    rewards: 100000,
    bonus: 50000
  };
  
  return (baseDifficulty[method] || 250000) * Math.log10(amount + 1);
};

const getMethodMultiplier = (method) => {
  const multipliers = {
    quantum: 1.2,
    mining: 1.0,
    staking: 0.9,
    rewards: 1.1,
    bonus: 1.5
  };
  return multipliers[method] || 1.0;
};

const calculateFees = (method, amount) => {
  const feeRates = {
    quantum: 0.02,  // 2%
    mining: 0.01,   // 1%
    staking: 0.005, // 0.5%
    rewards: 0.001, // 0.1%
    bonus: 0        // 0%
  };
  
  const processingFee = amount * (feeRates[method] || 0.01);
  const networkFee = Math.min(amount * 0.001, 10); // Max 10 QMC
  
  return {
    processingFee,
    networkFee,
    totalFee: processingFee + networkFee
  };
};

const getSuccessRate = (method, complexity) => {
  const baseRates = {
    quantum: 0.95,
    mining: 0.85,
    staking: 0.90,
    rewards: 0.98,
    bonus: 0.99
  };
  
  const baseRate = baseRates[method] || 0.85;
  const complexityPenalty = (complexity - 5) * 0.02; // 2% penalty per complexity point above 5
  
  return Math.max(baseRate - complexityPenalty, 0.5); // Minimum 50% success rate
};

module.exports = {
  generateMoney,
  getGenerationHistory,
  getGenerationById,
  cancelGeneration
};
