const providerService = require('../services/provider.service');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

/**
 * Initialize providers
 * @route POST /api/providers/initialize
 */
exports.initializeProviders = async (req, res, next) => {
  try {
    await providerService.initializeProviders();
    
    res.status(200).json({
      success: true,
      message: 'Providers initialized successfully'
    });
  } catch (error) {
    logger.error(`Initialize providers error: ${error.message}`);
    next(error);
  }
};

/**
 * Get all providers
 * @route GET /api/providers
 */
exports.getAllProviders = async (req, res, next) => {
  try {
    const providers = await providerService.getAllProviders();
    
    res.status(200).json({
      success: true,
      data: providers
    });
  } catch (error) {
    logger.error(`Get all providers error: ${error.message}`);
    next(error);
  }
};

/**
 * Get active providers
 * @route GET /api/providers/active
 */
exports.getActiveProviders = async (req, res, next) => {
  try {
    const providers = await providerService.getActiveProviders();
    
    res.status(200).json({
      success: true,
      data: providers
    });
  } catch (error) {
    logger.error(`Get active providers error: ${error.message}`);
    next(error);
  }
};

/**
 * Get provider by code
 * @route GET /api/providers/:code
 */
exports.getProviderByCode = async (req, res, next) => {
  try {
    const { code } = req.params;
    
    const provider = await providerService.getProviderByCode(code);
    
    res.status(200).json({
      success: true,
      data: provider
    });
  } catch (error) {
    logger.error(`Get provider error: ${error.message}`);
    next(error);
  }
};

/**
 * Create provider
 * @route POST /api/providers
 */
exports.createProvider = async (req, res, next) => {
  try {
    const provider = await providerService.createProvider(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Provider created successfully',
      data: provider
    });
  } catch (error) {
    logger.error(`Create provider error: ${error.message}`);
    next(error);
  }
};

/**
 * Update provider
 * @route PUT /api/providers/:code
 */
exports.updateProvider = async (req, res, next) => {
  try {
    const { code } = req.params;
    
    const provider = await providerService.updateProvider(code, req.body);
    
    res.status(200).json({
      success: true,
      message: 'Provider updated successfully',
      data: provider
    });
  } catch (error) {
    logger.error(`Update provider error: ${error.message}`);
    next(error);
  }
};

/**
 * Delete provider
 * @route DELETE /api/providers/:code
 */
exports.deleteProvider = async (req, res, next) => {
  try {
    const { code } = req.params;
    
    const result = await providerService.deleteProvider(code);
    
    res.status(200).json({
      success: true,
      message: 'Provider deleted successfully'
    });
  } catch (error) {
    logger.error(`Delete provider error: ${error.message}`);
    next(error);
  }
};

/**
 * Toggle provider status
 * @route PATCH /api/providers/:code/toggle-status
 */
exports.toggleProviderStatus = async (req, res, next) => {
  try {
    const { code } = req.params;
    
    const provider = await providerService.toggleProviderStatus(code);
    
    res.status(200).json({
      success: true,
      message: `Provider ${provider.isActive ? 'activated' : 'deactivated'} successfully`,
      data: provider
    });
  } catch (error) {
    logger.error(`Toggle provider status error: ${error.message}`);
    next(error);
  }
};

/**
 * Get provider fee structure
 * @route GET /api/providers/:code/fee-structure
 */
exports.getProviderFeeStructure = async (req, res, next) => {
  try {
    const { code } = req.params;
    
    const feeStructure = await providerService.getProviderFeeStructure(code);
    
    res.status(200).json({
      success: true,
      data: feeStructure
    });
  } catch (error) {
    logger.error(`Get provider fee structure error: ${error.message}`);
    next(error);
  }
};

/**
 * Calculate provider fee
 * @route POST /api/providers/:code/calculate-fee
 */
exports.calculateProviderFee = async (req, res, next) => {
  try {
    const { code } = req.params;
    const { amount, currency } = req.body;
    
    if (!amount || isNaN(amount) || amount <= 0) {
      return next(new ApiError(400, 'Valid amount is required'));
    }
    
    const fee = await providerService.calculateProviderFee(code, amount, currency);
    
    res.status(200).json({
      success: true,
      data: {
        amount,
        currency,
        fee,
        total: amount + fee
      }
    });
  } catch (error) {
    logger.error(`Calculate provider fee error: ${error.message}`);
    next(error);
  }
};