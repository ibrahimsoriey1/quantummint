const walletService = require('../services/wallet.service');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

/**
 * Get user wallet
 * @route GET /api/wallets/my-wallet
 */
exports.getUserWallet = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const wallet = await walletService.getOrCreateWallet(userId);
    
    res.status(200).json({
      success: true,
      data: wallet
    });
  } catch (error) {
    logger.error(`Get user wallet error: ${error.message}`);
    next(error);
  }
};

/**
 * Update generation method
 * @route PUT /api/wallets/method
 */
exports.updateGenerationMethod = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { method } = req.body;
    
    const wallet = await walletService.updateGenerationMethod(userId, method);
    
    res.status(200).json({
      success: true,
      message: 'Generation method updated successfully',
      data: wallet
    });
  } catch (error) {
    logger.error(`Update generation method error: ${error.message}`);
    next(error);
  }
};

/**
 * Get all wallets (admin only)
 * @route GET /api/wallets/admin/all
 */
exports.getAllWallets = async (req, res, next) => {
  try {
    const { page, limit, status, method, minBalance, maxBalance, sort } = req.query;
    
    const result = await walletService.getAllWallets({
      page,
      limit,
      status,
      method,
      minBalance,
      maxBalance,
      sort
    });
    
    res.status(200).json({
      success: true,
      data: result.wallets,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error(`Get all wallets error: ${error.message}`);
    next(error);
  }
};

/**
 * Get wallet by user ID (admin only)
 * @route GET /api/wallets/admin/user/:userId
 */
exports.getWalletByUserId = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const wallet = await walletService.getWalletByUserId(userId);
    
    res.status(200).json({
      success: true,
      data: wallet
    });
  } catch (error) {
    logger.error(`Get wallet by user ID error: ${error.message}`);
    next(error);
  }
};

/**
 * Update wallet status (admin only)
 * @route PUT /api/wallets/admin/status/:userId
 */
exports.updateWalletStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    
    const wallet = await walletService.updateWalletStatus(userId, status);
    
    res.status(200).json({
      success: true,
      message: 'Wallet status updated successfully',
      data: wallet
    });
  } catch (error) {
    logger.error(`Update wallet status error: ${error.message}`);
    next(error);
  }
};

/**
 * Get wallet statistics (admin only)
 * @route GET /api/wallets/admin/statistics
 */
exports.getWalletStatistics = async (req, res, next) => {
  try {
    const statistics = await walletService.getWalletStatistics();
    
    res.status(200).json({
      success: true,
      data: statistics
    });
  } catch (error) {
    logger.error(`Get wallet statistics error: ${error.message}`);
    next(error);
  }
};