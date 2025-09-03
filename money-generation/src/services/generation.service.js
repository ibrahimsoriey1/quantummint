const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const Wallet = require('../models/wallet.model');
const Generation = require('../models/generation.model');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const { publishMessage } = require('../config/messageQueue');
require('dotenv').config();

// Generation limits
const STANDARD_DAILY_LIMIT = parseFloat(process.env.STANDARD_DAILY_LIMIT) || 1000;
const ACCELERATED_DAILY_LIMIT = parseFloat(process.env.ACCELERATED_DAILY_LIMIT) || 2000;
const PREMIUM_DAILY_LIMIT = parseFloat(process.env.PREMIUM_DAILY_LIMIT) || 5000;

// Generation rates (units per minute)
const STANDARD_RATE = parseFloat(process.env.STANDARD_RATE) || 10;
const ACCELERATED_RATE = parseFloat(process.env.ACCELERATED_RATE) || 20;
const PREMIUM_RATE = parseFloat(process.env.PREMIUM_RATE) || 50;

/**
 * Get generation limit based on method
 * @param {String} method - Generation method
 * @returns {Number} - Daily limit
 */
const getGenerationLimit = (method) => {
  switch (method) {
    case 'standard':
      return STANDARD_DAILY_LIMIT;
    case 'accelerated':
      return ACCELERATED_DAILY_LIMIT;
    case 'premium':
      return PREMIUM_DAILY_LIMIT;
    default:
      return STANDARD_DAILY_LIMIT;
  }
};

/**
 * Get generation rate based on method
 * @param {String} method - Generation method
 * @returns {Number} - Generation rate (units per minute)
 */
const getGenerationRate = (method) => {
  switch (method) {
    case 'standard':
      return STANDARD_RATE;
    case 'accelerated':
      return ACCELERATED_RATE;
    case 'premium':
      return PREMIUM_RATE;
    default:
      return STANDARD_RATE;
  }
};

/**
 * Check if KYC verification is required based on amount and method
 * @param {Number} amount - Amount to generate
 * @param {String} method - Generation method
 * @returns {Object} - KYC requirement details
 */
const checkKycRequirement = (amount, method) => {
  // KYC requirements based on amount and method
  if (amount > 5000) {
    return { required: true, level: 'tier_2' };
  } else if (amount > 1000) {
    return { required: true, level: 'tier_1' };
  } else if (method === 'premium' && amount > 0) {
    return { required: true, level: 'tier_1' };
  }
  
  return { required: false, level: 'none' };
};

/**
 * Verify user's KYC level
 * @param {String} userId - User ID
 * @param {String} requiredLevel - Required KYC level
 * @returns {Promise<Boolean>} - Whether user has sufficient KYC level
 */
const verifyKycLevel = async (userId, requiredLevel) => {
  try {
    if (requiredLevel === 'none') {
      return true;
    }
    
    // Call KYC service to verify user's KYC level
    const response = await axios.get(`${process.env.KYC_SERVICE_URL}/verify/${userId}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-service-key': process.env.SERVICE_KEY
      }
    });
    
    if (!response.data.success) {
      return false;
    }
    
    const userKycLevel = response.data.kycLevel;
    
    // Check if user's KYC level is sufficient
    switch (requiredLevel) {
      case 'tier_1':
        return ['tier_1', 'tier_2', 'tier_3'].includes(userKycLevel);
      case 'tier_2':
        return ['tier_2', 'tier_3'].includes(userKycLevel);
      case 'tier_3':
        return userKycLevel === 'tier_3';
      default:
        return false;
    }
  } catch (error) {
    logger.error(`Failed to verify KYC level: ${error.message}`);
    // Default to false if KYC service is unavailable
    return false;
  }
};

/**
 * Create a new generation request
 * @param {Object} data - Generation data
 * @returns {Promise<Object>} - Created generation
 */
const createGeneration = async (data) => {
  try {
    const { userId, amount, method, ipAddress, userAgent } = data;
    
    // Validate amount
    if (!amount || amount <= 0) {
      throw new ApiError(400, 'Invalid amount');
    }
    
    // Get or create wallet
    let wallet = await Wallet.findOne({ userId });
    
    if (!wallet) {
      wallet = new Wallet({ userId, generationMethod: method });
      await wallet.save();
    }
    
    // Check if wallet is active
    if (wallet.status !== 'active') {
      throw new ApiError(403, 'Wallet is not active');
    }
    
    // Update daily generation tracking
    wallet.updateDailyGeneration();
    
    // Check daily limit
    const limit = getGenerationLimit(method);
    if (wallet.isDailyLimitReached(limit)) {
      throw new ApiError(403, `Daily generation limit of ${limit} reached`);
    }
    
    // Check if amount exceeds remaining daily limit
    const remainingLimit = limit - wallet.dailyGeneration;
    if (amount > remainingLimit) {
      throw new ApiError(403, `Amount exceeds remaining daily limit of ${remainingLimit}`);
    }
    
    // Check KYC requirements
    const kycRequirement = checkKycRequirement(amount, method);
    
    // Create generation record
    const generation = new Generation({
      userId,
      amount,
      method,
      ipAddress,
      userAgent,
      kycLevel: kycRequirement.level,
      status: 'pending',
      verificationStatus: kycRequirement.required ? 'pending' : 'not_required'
    });
    
    await generation.save();
    
    // If KYC verification is required, check user's KYC level
    if (kycRequirement.required) {
      const hasKyc = await verifyKycLevel(userId, kycRequirement.level);
      
      if (!hasKyc) {
        generation.status = 'failed';
        generation.verificationStatus = 'rejected';
        generation.verificationReason = `KYC level ${kycRequirement.level} required`;
        await generation.save();
        
        throw new ApiError(403, `KYC verification level ${kycRequirement.level} required for this amount`);
      }
      
      // KYC verified, update generation
      generation.verificationStatus = 'approved';
      await generation.save();
    }
    
    // Calculate generation time based on method and amount
    const rate = getGenerationRate(method);
    const generationTimeMinutes = amount / rate;
    
    // For demo purposes, we'll use a much shorter time
    const demoTimeSeconds = Math.min(10, generationTimeMinutes * 60);
    
    // Publish message to start generation process
    await publishMessage('generation.start', {
      generationId: generation._id,
      userId,
      amount,
      method,
      estimatedCompletionTime: new Date(Date.now() + demoTimeSeconds * 1000)
    });
    
    return {
      generation,
      estimatedCompletionTime: new Date(Date.now() + demoTimeSeconds * 1000),
      estimatedMinutes: generationTimeMinutes
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Generation creation error: ${error.message}`);
    throw new ApiError(500, 'Failed to create generation request');
  }
};

/**
 * Complete a generation request
 * @param {String} generationId - Generation ID
 * @returns {Promise<Object>} - Updated generation
 */
const completeGeneration = async (generationId) => {
  try {
    // Find generation
    const generation = await Generation.findById(generationId);
    
    if (!generation) {
      throw new ApiError(404, 'Generation not found');
    }
    
    if (generation.status !== 'pending') {
      throw new ApiError(400, `Generation is already ${generation.status}`);
    }
    
    // Find wallet
    const wallet = await Wallet.findOne({ userId: generation.userId });
    
    if (!wallet) {
      throw new ApiError(404, 'Wallet not found');
    }
    
    // Update wallet
    wallet.addFunds(generation.amount);
    await wallet.save();
    
    // Update generation
    generation.status = 'completed';
    generation.updatedAt = new Date();
    await generation.save();
    
    // Create transaction record via Transaction Service
    try {
      const transactionResponse = await axios.post(
        `${process.env.TRANSACTION_SERVICE_URL}/internal`,
        {
          userId: generation.userId,
          type: 'generation',
          amount: generation.amount,
          method: generation.method,
          reference: generation._id,
          description: `Money generation via ${generation.method} method`
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-service-key': process.env.SERVICE_KEY
          }
        }
      );
      
      if (transactionResponse.data.success) {
        generation.transactionId = transactionResponse.data.transaction._id;
        await generation.save();
      }
    } catch (error) {
      logger.error(`Failed to create transaction record: ${error.message}`);
      // Continue even if transaction record creation fails
    }
    
    // Publish completion message
    await publishMessage('generation.completed', {
      generationId: generation._id,
      userId: generation.userId,
      amount: generation.amount,
      method: generation.method,
      status: 'completed'
    });
    
    return generation;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Generation completion error: ${error.message}`);
    throw new ApiError(500, 'Failed to complete generation');
  }
};

/**
 * Get generation by ID
 * @param {String} generationId - Generation ID
 * @param {String} userId - User ID
 * @returns {Promise<Object>} - Generation
 */
const getGenerationById = async (generationId, userId) => {
  try {
    const generation = await Generation.findById(generationId);
    
    if (!generation) {
      throw new ApiError(404, 'Generation not found');
    }
    
    // Check if user owns the generation or is admin
    if (generation.userId !== userId) {
      throw new ApiError(403, 'You do not have permission to view this generation');
    }
    
    return generation;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Get generation error: ${error.message}`);
    throw new ApiError(500, 'Failed to get generation');
  }
};

/**
 * Get user generations
 * @param {String} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Generations with pagination
 */
const getUserGenerations = async (userId, options = {}) => {
  try {
    const { page = 1, limit = 10, status, method, sort = '-createdAt' } = options;
    
    // Build query
    const query = { userId };
    
    if (status) {
      query.status = status;
    }
    
    if (method) {
      query.method = method;
    }
    
    // Execute query with pagination
    const generations = await Generation.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);
    
    // Get total count
    const total = await Generation.countDocuments(query);
    
    return {
      generations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error(`Get user generations error: ${error.message}`);
    throw new ApiError(500, 'Failed to get generations');
  }
};

/**
 * Get all generations (admin only)
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Generations with pagination
 */
const getAllGenerations = async (options = {}) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      method, 
      userId,
      verificationStatus,
      sort = '-createdAt' 
    } = options;
    
    // Build query
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (method) {
      query.method = method;
    }
    
    if (userId) {
      query.userId = userId;
    }
    
    if (verificationStatus) {
      query.verificationStatus = verificationStatus;
    }
    
    // Execute query with pagination
    const generations = await Generation.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);
    
    // Get total count
    const total = await Generation.countDocuments(query);
    
    return {
      generations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error(`Get all generations error: ${error.message}`);
    throw new ApiError(500, 'Failed to get generations');
  }
};

/**
 * Verify generation (admin only)
 * @param {String} generationId - Generation ID
 * @param {Object} data - Verification data
 * @returns {Promise<Object>} - Updated generation
 */
const verifyGeneration = async (generationId, data) => {
  try {
    const { approved, reason, adminId } = data;
    
    // Find generation
    const generation = await Generation.findById(generationId);
    
    if (!generation) {
      throw new ApiError(404, 'Generation not found');
    }
    
    if (generation.verificationStatus !== 'pending') {
      throw new ApiError(400, `Generation is already ${generation.verificationStatus}`);
    }
    
    // Update generation
    generation.verificationStatus = approved ? 'approved' : 'rejected';
    generation.verificationReason = reason || null;
    generation.verifiedBy = adminId;
    generation.verifiedAt = new Date();
    
    // If rejected, update status
    if (!approved) {
      generation.status = 'rejected';
    }
    
    await generation.save();
    
    // If approved and generation is pending, complete it
    if (approved && generation.status === 'pending') {
      await completeGeneration(generationId);
    }
    
    // Publish verification message
    await publishMessage('generation.verified', {
      generationId: generation._id,
      userId: generation.userId,
      approved,
      reason,
      verifiedBy: adminId
    });
    
    return generation;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Generation verification error: ${error.message}`);
    throw new ApiError(500, 'Failed to verify generation');
  }
};

module.exports = {
  createGeneration,
  completeGeneration,
  getGenerationById,
  getUserGenerations,
  getAllGenerations,
  verifyGeneration,
  getGenerationLimit,
  getGenerationRate,
  checkKycRequirement
};