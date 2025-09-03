const Balance = require('../models/balance.model');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const { publishMessage } = require('../config/messageQueue');

/**
 * Get or create balance for user
 * @param {String} userId - User ID
 * @returns {Promise<Object>} - User balance
 */
const getOrCreateBalance = async (userId) => {
  try {
    // Find balance
    let balance = await Balance.findOne({ userId });
    
    // Create balance if not exists
    if (!balance) {
      balance = new Balance({ userId });
      await balance.save();
      
      // Publish balance created message
      await publishMessage('balance.created', {
        userId,
        balanceId: balance._id
      });
    }
    
    return balance;
  } catch (error) {
    logger.error(`Get or create balance error: ${error.message}`);
    throw new ApiError(500, 'Failed to get or create balance');
  }
};

/**
 * Get balance by user ID
 * @param {String} userId - User ID
 * @returns {Promise<Object>} - User balance
 */
const getBalanceByUserId = async (userId) => {
  try {
    const balance = await Balance.findOne({ userId });
    
    if (!balance) {
      throw new ApiError(404, 'Balance not found');
    }
    
    return balance;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Get balance error: ${error.message}`);
    throw new ApiError(500, 'Failed to get balance');
  }
};

/**
 * Update balance status
 * @param {String} userId - User ID
 * @param {String} status - Balance status
 * @returns {Promise<Object>} - Updated balance
 */
const updateBalanceStatus = async (userId, status) => {
  try {
    // Get balance
    const balance = await getBalanceByUserId(userId);
    
    // Update status
    balance.status = status;
    await balance.save();
    
    // Publish status updated message
    await publishMessage('balance.status_updated', {
      userId,
      balanceId: balance._id,
      status
    });
    
    return balance;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Update balance status error: ${error.message}`);
    throw new ApiError(500, 'Failed to update balance status');
  }
};

/**
 * Get all balances (admin only)
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Balances with pagination
 */
const getAllBalances = async (options = {}) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      minBalance,
      maxBalance,
      sort = '-createdAt' 
    } = options;
    
    // Build query
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (minBalance !== undefined || maxBalance !== undefined) {
      query.available = {};
      
      if (minBalance !== undefined) {
        query.available.$gte = parseFloat(minBalance);
      }
      
      if (maxBalance !== undefined) {
        query.available.$lte = parseFloat(maxBalance);
      }
    }
    
    // Execute query with pagination
    const balances = await Balance.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);
    
    // Get total count
    const total = await Balance.countDocuments(query);
    
    return {
      balances,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error(`Get all balances error: ${error.message}`);
    throw new ApiError(500, 'Failed to get balances');
  }
};

/**
 * Get balance statistics
 * @returns {Promise<Object>} - Balance statistics
 */
const getBalanceStatistics = async () => {
  try {
    // Get total balances
    const totalBalances = await Balance.countDocuments();
    
    // Get active balances
    const activeBalances = await Balance.countDocuments({ status: 'active' });
    
    // Get suspended balances
    const suspendedBalances = await Balance.countDocuments({ status: 'suspended' });
    
    // Get locked balances
    const lockedBalances = await Balance.countDocuments({ status: 'locked' });
    
    // Get total available balance
    const totalAvailableResult = await Balance.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$available' }
        }
      }
    ]);
    
    const totalAvailable = totalAvailableResult.length > 0 ? totalAvailableResult[0].total : 0;
    
    // Get total pending balance
    const totalPendingResult = await Balance.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$pending' }
        }
      }
    ]);
    
    const totalPending = totalPendingResult.length > 0 ? totalPendingResult[0].total : 0;
    
    // Get total reserved balance
    const totalReservedResult = await Balance.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$reserved' }
        }
      }
    ]);
    
    const totalReserved = totalReservedResult.length > 0 ? totalReservedResult[0].total : 0;
    
    // Get total balance
    const totalBalanceResult = await Balance.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$total' }
        }
      }
    ]);
    
    const totalBalance = totalBalanceResult.length > 0 ? totalBalanceResult[0].total : 0;
    
    return {
      totalBalances,
      activeBalances,
      suspendedBalances,
      lockedBalances,
      totalAvailable,
      totalPending,
      totalReserved,
      totalBalance
    };
  } catch (error) {
    logger.error(`Get balance statistics error: ${error.message}`);
    throw new ApiError(500, 'Failed to get balance statistics');
  }
};

module.exports = {
  getOrCreateBalance,
  getBalanceByUserId,
  updateBalanceStatus,
  getAllBalances,
  getBalanceStatistics
};
