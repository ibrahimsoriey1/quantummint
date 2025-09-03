const generationService = require('../services/generation.service');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

/**
 * Create generation request
 * @route POST /api/generation
 */
exports.createGeneration = async (req, res, next) => {
  try {
    const { amount, method } = req.body;
    const userId = req.user.id;
    
    // Create generation with client info
    const result = await generationService.createGeneration({
      userId,
      amount,
      method,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.status(201).json({
      success: true,
      message: 'Generation request created successfully',
      data: {
        generation: result.generation,
        estimatedCompletionTime: result.estimatedCompletionTime,
        estimatedMinutes: result.estimatedMinutes
      }
    });
  } catch (error) {
    logger.error(`Create generation error: ${error.message}`);
    next(error);
  }
};

/**
 * Get generation by ID
 * @route GET /api/generation/:id
 */
exports.getGenerationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const generation = await generationService.getGenerationById(id, userId);
    
    res.status(200).json({
      success: true,
      data: generation
    });
  } catch (error) {
    logger.error(`Get generation error: ${error.message}`);
    next(error);
  }
};

/**
 * Get user generations
 * @route GET /api/generation
 */
exports.getUserGenerations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page, limit, status, method, sort } = req.query;
    
    const result = await generationService.getUserGenerations(userId, {
      page,
      limit,
      status,
      method,
      sort
    });
    
    res.status(200).json({
      success: true,
      data: result.generations,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error(`Get user generations error: ${error.message}`);
    next(error);
  }
};

/**
 * Get all generations (admin only)
 * @route GET /api/generation/admin/all
 */
exports.getAllGenerations = async (req, res, next) => {
  try {
    const { page, limit, status, method, userId, verificationStatus, sort } = req.query;
    
    const result = await generationService.getAllGenerations({
      page,
      limit,
      status,
      method,
      userId,
      verificationStatus,
      sort
    });
    
    res.status(200).json({
      success: true,
      data: result.generations,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error(`Get all generations error: ${error.message}`);
    next(error);
  }
};

/**
 * Verify generation (admin only)
 * @route POST /api/generation/admin/verify/:id
 */
exports.verifyGeneration = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { approved, reason } = req.body;
    const adminId = req.user.id;
    
    const generation = await generationService.verifyGeneration(id, {
      approved,
      reason,
      adminId
    });
    
    res.status(200).json({
      success: true,
      message: `Generation ${approved ? 'approved' : 'rejected'} successfully`,
      data: generation
    });
  } catch (error) {
    logger.error(`Verify generation error: ${error.message}`);
    next(error);
  }
};

/**
 * Complete generation (internal use only)
 * @route POST /api/generation/internal/complete/:id
 */
exports.completeGeneration = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const generation = await generationService.completeGeneration(id);
    
    res.status(200).json({
      success: true,
      message: 'Generation completed successfully',
      data: generation
    });
  } catch (error) {
    logger.error(`Complete generation error: ${error.message}`);
    next(error);
  }
};

/**
 * Get generation limits
 * @route GET /api/generation/limits
 */
exports.getGenerationLimits = async (req, res, next) => {
  try {
    // Get limits for all methods
    const standardLimit = generationService.getGenerationLimit('standard');
    const acceleratedLimit = generationService.getGenerationLimit('accelerated');
    const premiumLimit = generationService.getGenerationLimit('premium');
    
    // Get rates for all methods
    const standardRate = generationService.getGenerationRate('standard');
    const acceleratedRate = generationService.getGenerationRate('accelerated');
    const premiumRate = generationService.getGenerationRate('premium');
    
    res.status(200).json({
      success: true,
      data: {
        limits: {
          standard: standardLimit,
          accelerated: acceleratedLimit,
          premium: premiumLimit
        },
        rates: {
          standard: standardRate,
          accelerated: acceleratedRate,
          premium: premiumRate
        },
        kycRequirements: {
          standard: [
            { maxAmount: 1000, kycLevel: 'none' },
            { maxAmount: 5000, kycLevel: 'tier_1' },
            { maxAmount: Infinity, kycLevel: 'tier_2' }
          ],
          accelerated: [
            { maxAmount: 2000, kycLevel: 'none' },
            { maxAmount: 5000, kycLevel: 'tier_1' },
            { maxAmount: Infinity, kycLevel: 'tier_2' }
          ],
          premium: [
            { maxAmount: 1000, kycLevel: 'tier_1' },
            { maxAmount: 5000, kycLevel: 'tier_1' },
            { maxAmount: Infinity, kycLevel: 'tier_2' }
          ]
        }
      }
    });
  } catch (error) {
    logger.error(`Get generation limits error: ${error.message}`);
    next(error);
  }
};
