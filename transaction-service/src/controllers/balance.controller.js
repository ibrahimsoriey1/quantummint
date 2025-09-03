const balanceService = require('../services/balance.service');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

/**
 * Get user balance
 * @route GET /api/balances/my-balance
 */
exports.getUserBalance = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const balance = await balanceService.getOrCreateBalance(userId);
    
    res.status(200).json({
      success: true,
      data: balance
    });
  } catch (error) {
    logger.error(`Get user balance error: ${error.message}`);
    next(error);
  }
};

/**
 * Get balance by user ID (admin only)
 * @route GET /api/balances/admin/user/:userId
 */
exports.getBalanceByUserId = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const balance = await balanceService.getBalanceByUserId(userId);
    
    res.status(200).json({
      success: true,
      data: balance
    });
  } catch (error) {
    logger.error(`Get balance by user ID error: ${error.message}`);
    next(error);
  }
};

/**
 * Update balance status (admin only)
 * @route PUT /api/balances/admin/status/:userId
 */
exports.updateBalanceStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    
    const balance = await balanceService.updateBalanceStatus(userId, status);
    
    res.status(200).json({
      success: true,
      message: 'Balance status updated successfully',
      data: balance
    });
  } catch (error) {
    logger.error(`Update balance status error: ${error.message}`);
    next(error);
  }
};

/**
 * Get all balances (admin only)
 * @route GET /api/balances/admin/all
 */
exports.getAllBalances = async (req, res, next) => {
  try {
    const { page, limit, status, minBalance, maxBalance, sort } = req.query;
    
    const result = await balanceService.getAllBalances({
      page,
      limit,
      status,
      minBalance,
      maxBalance,
      sort
    });
    
    res.status(200).json({
      success: true,
      data: result.balances,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error(`Get all balances error: ${error.message}`);
    next(error);
  }
};

/**
 * Get balance statistics (admin only)
 * @route GET /api/balances/admin/statistics
 */
exports.getBalanceStatistics = async (req, res, next) => {
  try {
    const statistics = await balanceService.getBalanceStatistics();
    
    res.status(200).json({
      success: true,
      data: statistics
    });
  } catch (error) {
    logger.error(`Get balance statistics error: ${error.message}`);
    next(error);
  }
};