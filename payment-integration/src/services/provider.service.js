const Provider = require('../models/provider.model');
const providerFactory = require('../providers/provider.factory');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

/**
 * Initialize providers
 * @returns {Promise<void>}
 */
const initializeProviders = async () => {
  try {
    // Get all providers from factory
    const factoryProviders = providerFactory.getAllProviderDetails();
    
    // For each provider, create or update in database
    for (const providerDetails of factoryProviders) {
      const { code, name } = providerDetails;
      
      // Check if provider exists
      let provider = await Provider.findOne({ code });
      
      if (!provider) {
        // Create new provider
        provider = new Provider({
          name,
          code,
          type: 'both',
          description: `${name} payment provider`,
          isActive: true,
          supportedCountries: providerDetails.supportedCountries || [],
          supportedCurrencies: providerDetails.supportedCurrencies || [],
          minAmount: 0.01,
          maxAmount: 10000,
          processingTime: 'Instant',
          feeStructure: {
            type: 'percentage',
            value: code === 'stripe' ? 2.9 : (code === 'orange_money' ? 1.5 : 2.0)
          },
          requiredKycLevel: 'none',
          config: {}
        });
        
        await provider.save();
        logger.info(`Provider created: ${name}`);
      } else {
        // Update existing provider
        provider.name = name;
        provider.supportedCountries = providerDetails.supportedCountries || provider.supportedCountries;
        provider.supportedCurrencies = providerDetails.supportedCurrencies || provider.supportedCurrencies;
        
        await provider.save();
        logger.info(`Provider updated: ${name}`);
      }
    }
    
    logger.info('Providers initialized successfully');
  } catch (error) {
    logger.error(`Provider initialization error: ${error.message}`);
    throw error;
  }
};

/**
 * Get all providers
 * @returns {Promise<Array>} - All providers
 */
const getAllProviders = async () => {
  try {
    return await Provider.find();
  } catch (error) {
    logger.error(`Get all providers error: ${error.message}`);
    throw new ApiError(500, 'Failed to get providers');
  }
};

/**
 * Get active providers
 * @returns {Promise<Array>} - Active providers
 */
const getActiveProviders = async () => {
  try {
    return await Provider.find({ isActive: true });
  } catch (error) {
    logger.error(`Get active providers error: ${error.message}`);
    throw new ApiError(500, 'Failed to get active providers');
  }
};

/**
 * Get provider by code
 * @param {String} code - Provider code
 * @returns {Promise<Object>} - Provider
 */
const getProviderByCode = async (code) => {
  try {
    const provider = await Provider.findOne({ code });
    
    if (!provider) {
      throw new ApiError(404, 'Provider not found');
    }
    
    return provider;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Get provider error: ${error.message}`);
    throw new ApiError(500, 'Failed to get provider');
  }
};

/**
 * Create provider
 * @param {Object} data - Provider data
 * @returns {Promise<Object>} - Created provider
 */
const createProvider = async (data) => {
  try {
    const { 
      name, 
      code, 
      type = 'both', 
      description, 
      logo,
      isActive = true,
      supportedCountries = [],
      supportedCurrencies = [],
      minAmount = 0.01,
      maxAmount = 10000,
      processingTime = 'Instant',
      feeStructure = { type: 'percentage', value: 0 },
      requiredKycLevel = 'none',
      config = {},
      webhookEndpoint,
      metadata = {}
    } = data;
    
    // Check if provider code is valid
    if (!['stripe', 'orange_money', 'afrimoney'].includes(code)) {
      throw new ApiError(400, 'Invalid provider code');
    }
    
    // Check if provider already exists
    const existingProvider = await Provider.findOne({ code });
    
    if (existingProvider) {
      throw new ApiError(409, `Provider with code '${code}' already exists`);
    }
    
    // Create provider
    const provider = new Provider({
      name,
      code,
      type,
      description,
      logo,
      isActive,
      supportedCountries,
      supportedCurrencies,
      minAmount,
      maxAmount,
      processingTime,
      feeStructure,
      requiredKycLevel,
      config,
      webhookEndpoint,
      metadata
    });
    
    await provider.save();
    
    return provider;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Create provider error: ${error.message}`);
    throw new ApiError(500, 'Failed to create provider');
  }
};

/**
 * Update provider
 * @param {String} code - Provider code
 * @param {Object} data - Provider data
 * @returns {Promise<Object>} - Updated provider
 */
const updateProvider = async (code, data) => {
  try {
    const provider = await Provider.findOne({ code });
    
    if (!provider) {
      throw new ApiError(404, 'Provider not found');
    }
    
    // Update provider fields
    const updateableFields = [
      'name',
      'description',
      'logo',
      'isActive',
      'supportedCountries',
      'supportedCurrencies',
      'minAmount',
      'maxAmount',
      'processingTime',
      'feeStructure',
      'requiredKycLevel',
      'config',
      'webhookEndpoint',
      'metadata'
    ];
    
    updateableFields.forEach(field => {
      if (data[field] !== undefined) {
        provider[field] = data[field];
      }
    });
    
    await provider.save();
    
    return provider;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Update provider error: ${error.message}`);
    throw new ApiError(500, 'Failed to update provider');
  }
};

/**
 * Delete provider
 * @param {String} code - Provider code
 * @returns {Promise<Object>} - Deleted provider
 */
const deleteProvider = async (code) => {
  try {
    const provider = await Provider.findOne({ code });
    
    if (!provider) {
      throw new ApiError(404, 'Provider not found');
    }
    
    await provider.deleteOne();
    
    return { success: true, message: 'Provider deleted successfully' };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Delete provider error: ${error.message}`);
    throw new ApiError(500, 'Failed to delete provider');
  }
};

/**
 * Toggle provider status
 * @param {String} code - Provider code
 * @returns {Promise<Object>} - Updated provider
 */
const toggleProviderStatus = async (code) => {
  try {
    const provider = await Provider.findOne({ code });
    
    if (!provider) {
      throw new ApiError(404, 'Provider not found');
    }
    
    provider.isActive = !provider.isActive;
    await provider.save();
    
    return provider;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Toggle provider status error: ${error.message}`);
    throw new ApiError(500, 'Failed to toggle provider status');
  }
};

/**
 * Get provider fee structure
 * @param {String} code - Provider code
 * @returns {Promise<Object>} - Fee structure
 */
const getProviderFeeStructure = async (code) => {
  try {
    const provider = await Provider.findOne({ code });
    
    if (!provider) {
      throw new ApiError(404, 'Provider not found');
    }
    
    return {
      feeStructure: provider.feeStructure,
      minAmount: provider.minAmount,
      maxAmount: provider.maxAmount
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Get provider fee structure error: ${error.message}`);
    throw new ApiError(500, 'Failed to get provider fee structure');
  }
};

/**
 * Calculate provider fee
 * @param {String} code - Provider code
 * @param {Number} amount - Amount
 * @param {String} currency - Currency
 * @returns {Promise<Number>} - Fee amount
 */
const calculateProviderFee = async (code, amount, currency) => {
  try {
    const provider = await Provider.findOne({ code });
    
    if (!provider) {
      throw new ApiError(404, 'Provider not found');
    }
    
    // Calculate fee based on fee structure
    let fee = 0;
    
    if (provider.feeStructure.type === 'percentage') {
      fee = (amount * provider.feeStructure.value) / 100;
    } else if (provider.feeStructure.type === 'fixed') {
      fee = provider.feeStructure.value;
    } else if (provider.feeStructure.type === 'mixed') {
      fee = (amount * provider.feeStructure.percentageValue) / 100 + provider.feeStructure.fixedValue;
    }
    
    return fee;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Calculate provider fee error: ${error.message}`);
    throw new ApiError(500, 'Failed to calculate provider fee');
  }
};

module.exports = {
  initializeProviders,
  getAllProviders,
  getActiveProviders,
  getProviderByCode,
  createProvider,
  updateProvider,
  deleteProvider,
  toggleProviderStatus,
  getProviderFeeStructure,
  calculateProviderFee
};