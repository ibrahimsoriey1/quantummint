const generationService = require('../services/generation.service');
const { GenerationError } = require('../utils/errors.util');
const logger = require('../utils/logger.util');

/**
 * Generate money
 */
exports.generateMoney = async (req, res) => {
  try {
    const { userId } = req.user;
    const { walletId, amount, generationMethod } = req.body;
    
    // Generate money
    const result = await generationService.generateMoney(
      userId,
      walletId,
      amount,
      generationMethod,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    );
    
    return res.status(200).json({
      success: true,
      message: 'Money generation initiated',
      data: result
    });
  } catch (error) {
    if (error instanceof GenerationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }
    
    logger.error(`Generate money controller error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during money generation'
      }
    });
  }
};

/**
 * Verify generation
 */
exports.verifyGeneration = async (req, res) => {
  try {
    const { generationId, verificationCode } = req.body;
    
    // Verify generation
    const result = await generationService.verifyGeneration(generationId, verificationCode);
    
    return res.status(200).json({
      success: true,
      message: 'Money generation verified successfully',
      data: result
    });
  } catch (error) {
    if (error instanceof GenerationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }
    
    logger.error(`Verify generation controller error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during generation verification'
      }
    });
  }
};

/**
 * Get generation status
 */
exports.getGenerationStatus = async (req, res) => {
  try {
    const { generationId } = req.params;
    
    // Get generation status
    const result = await generationService.getGenerationStatus(generationId);
    
    // Check if user has permission to view this generation
    if (result.userId !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this generation'
        }
      });
    }
    
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error instanceof GenerationError) {
      if (error.code === 'RECORD_NOT_FOUND') {
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
    
    logger.error(`Get generation status controller error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while retrieving generation status'
      }
    });
  }
};

/**
 * Get generation history
 */
exports.getGenerationHistory = async (req, res) => {
  try {
    const { userId } = req.user;
    const { page, limit, status, startDate, endDate, walletId } = req.query;
    
    // Get generation history
    const result = await generationService.getGenerationHistory(userId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
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
    logger.error(`Get generation history controller error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while retrieving generation history'
      }
    });
  }
};