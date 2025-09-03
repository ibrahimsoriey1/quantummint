const Wallet = require('../models/wallet.model');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const { publishMessage } = require('../config/messageQueue');

/**
 * Get or create wallet for user
 * @param {String} userId - User ID
 * @returns {Promise<Object>} - User wallet
 */
const getOrCreateWallet = async (userId) => {
  try {
    // Find wallet
    let wallet = await Wallet.findOne({ userId });
    
    // Create wallet if not exists
    if (!wallet) {
      wallet = new Wallet({ userId });
      await wallet.save();
      
      // Publish wallet created message
      await publishMessage('wallet.created', {
        userId,
        walletId: wallet._id
      });
    }
    
    return wallet;
  } catch (error) {
    logger.error(`Get or create wallet error: ${error.message}`);
    throw new ApiError(500, 'Failed to get or create wallet');
  }
};

/**
 * Get wallet by user ID
 * @param {String} userId - User ID
 * @returns {Promise<Object>} - User wallet
 */
const getWalletByUserId = async (userId) => {
  try {
    const wallet = await Wallet.findOne({ userId });
    
    if (!wallet) {
      throw new ApiError(404, 'Wallet not found');
    }
    
    return wallet;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Get wallet error: ${error.message}`);
    throw new ApiError(500, 'Failed to get wallet');
  }
};

/**
 * Update wallet generation method
 * @param {String} userId - User ID
 * @param {String} method - Generation method
 * @returns {Promise<Object>} - Updated wallet
 */
const updateGenerationMethod = async (userId, method) => {
  try {
    // Get wallet
    const wallet = await getOrCreateWallet(userId);
    
    // Update method
    wallet.generationMethod = method;
    await wallet.save();
    
    // Publish method updated message
    await publishMessage('wallet.method_updated', {
      userId,
      walletId: wallet._id,
      method
    });
    
    return wallet;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Update generation method error: ${error.message}`);
    throw new ApiError(500, 'Failed to update generation method');
  }
};

/**
 * Update wallet status
 * @param {String} userId - User ID
 * @param {String} status - Wallet status
 * @returns {Promise<Object>} - Updated wallet
 */
const updateWalletStatus = async (userId, status) => {
  try {
    // Get wallet
    const wallet = await getWalletByUserId(userId);
    
    // Update status
    wallet.status = status;
    await wallet.save();
    
    // Publish status updated message
    await publishMessage('wallet.status_updated', {
      userId,
      walletId: wallet._id,
      status
    });
    
    return wallet;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Update wallet status error: ${error.message}`);
    throw new ApiError(500, 'Failed to update wallet status');
  }
};

/**
 * Get all wallets (admin only)
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Wallets with pagination
 */
const getAllWallets = async (options = {}) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      method,
      minBalance,
      maxBalance,
      sort = '-createdAt' 
    } = options;
    
    // Build query
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (method) {
      query.generationMethod = method;
    }
    
    if (minBalance !== undefined || maxBalance !== undefined) {
      query.balance = {};
      
      if (minBalance !== undefined) {
        query.balance.$gte = parseFloat(minBalance);
      }
      
      if (maxBalance !== undefined) {
        query.balance.$lte = parseFloat(maxBalance);
      }
    }
    
    // Execute query with pagination
    const wallets = await Wallet.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);
    
    // Get total count
    const total = await Wallet.countDocuments(query);
    
    return {
      wallets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error(`Get all wallets error: ${error.message}`);
    throw new ApiError(500, 'Failed to get wallets');
  }
};

/**
 * Get wallet statistics
 * @returns {Promise<Object>} - Wallet statistics
 */
const getWalletStatistics = async () => {
  try {
    // Get total wallets
    const totalWallets = await Wallet.countDocuments();
    
    // Get active wallets
    const activeWallets = await Wallet.countDocuments({ status: 'active' });
    
    // Get suspended wallets
    const suspendedWallets = await Wallet.countDocuments({ status: 'suspended' });
    
    // Get locked wallets
    const lockedWallets = await Wallet.countDocuments({ status: 'locked' });
    
    // Get total balance
    const totalBalanceResult = await Wallet.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$balance' }
        }
      }
    ]);
    
    const totalBalance = totalBalanceResult.length > 0 ? totalBalanceResult[0].total : 0;
    
    // Get total generated
    const totalGeneratedResult = await Wallet.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$totalGenerated' }
        }
      }
    ]);
    
    const totalGenerated = totalGeneratedResult.length > 0 ? totalGeneratedResult[0].total : 0;
    
    // Get method distribution
    const methodDistribution = await Wallet.aggregate([
      {
        $group: {
          _id: '$generationMethod',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Format method distribution
    const formattedMethodDistribution = {};
    methodDistribution.forEach(item => {
      formattedMethodDistribution[item._id] = item.count;
    });
    
    return {
      totalWallets,
      activeWallets,
      suspendedWallets,
      lockedWallets,
      totalBalance,
      totalGenerated,
      methodDistribution: formattedMethodDistribution
    };
  } catch (error) {
    logger.error(`Get wallet statistics error: ${error.message}`);
    throw new ApiError(500, 'Failed to get wallet statistics');
  }
};

module.exports = {
  getOrCreateWallet,
  getWalletByUserId,
  updateGenerationMethod,
  updateWalletStatus,
  getAllWallets,
  getWalletStatistics
};