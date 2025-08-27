const walletService = require('../services/wallet.service');
const { validateWalletRequest, validateWalletStatusRequest, validateWalletNameRequest } = require('../validation/wallet.validation');
const { WalletError } = require('../utils/errors.util');
const logger = require('../utils/logger.util');

/**
 * Create a new wallet
 */
exports.createWallet = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Validate request
    const { error, value } = validateWalletRequest(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid wallet request',
          details: error.details.map(d => ({ field: d.path[0], message: d.message }))
        }
      });
    }
    
    // Ensure userId in the wallet matches the authenticated user
    // (unless admin role)
    if (value.userId && value.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You cannot create wallets for other users'
        }
      });
    }
    
    // Set userId if not provided
    if (!value.userId) {
      value.userId = userId;
    }
    
    // Create wallet
    const wallet = await walletService.createWallet(value);
    
    return res.status(201).json({
      success: true,
      message: 'Wallet created successfully',
      data: wallet
    });
  } catch (error) {
    if (error instanceof WalletError) {
      return res.status(400).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }
    
    logger.error(`Create wallet controller error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during wallet creation'
      }
    });
  }
};

/**
 * Get user wallets
 */
exports.getUserWallets = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get wallets
    const wallets = await walletService.getUserWallets(userId);
    
    return res.status(200).json({
      success: true,
      data: {
        wallets
      }
    });
  } catch (error) {
    logger.error(`Get user wallets controller error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while retrieving wallets'
      }
    });
  }
};

/**
 * Get wallet details
 */
exports.getWallet = async (req, res) => {
  try {
    const { walletId } = req.params;
    const userId = req.user.userId;
    
    // Get wallet
    const wallet = await walletService.getWallet(walletId);
    
    // Check if user has permission to view this wallet
    if (wallet.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this wallet'
        }
      });
    }
    
    return res.status(200).json({
      success: true,
      data: wallet
    });
  } catch (error) {
    if (error instanceof WalletError) {
      if (error.code === 'NOT_FOUND') {
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
    
    logger.error(`Get wallet controller error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while retrieving wallet'
      }
    });
  }
};

/**
 * Update wallet status
 */
exports.updateWalletStatus = async (req, res) => {
  try {
    const { walletId } = req.params;
    const userId = req.user.userId;
    
    // Validate request
    const { error, value } = validateWalletStatusRequest(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid wallet status request',
          details: error.details.map(d => ({ field: d.path[0], message: d.message }))
        }
      });
    }
    
    // Get wallet to check ownership
    const wallet = await walletService.getWallet(walletId);
    
    // Check if user has permission to update this wallet
    if (wallet.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to update this wallet'
        }
      });
    }
    
    // Update wallet status
    const updatedWallet = await walletService.updateWalletStatus(walletId, value.status);
    
    return res.status(200).json({
      success: true,
      message: 'Wallet status updated successfully',
      data: updatedWallet
    });
  } catch (error) {
    if (error instanceof WalletError) {
      if (error.code === 'NOT_FOUND') {
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
    
    logger.error(`Update wallet status controller error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating wallet status'
      }
    });
  }
};

/**
 * Update wallet name
 */
exports.updateWalletName = async (req, res) => {
  try {
    const { walletId } = req.params;
    const userId = req.user.userId;
    
    // Validate request
    const { error, value } = validateWalletNameRequest(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid wallet name request',
          details: error.details.map(d => ({ field: d.path[0], message: d.message }))
        }
      });
    }
    
    // Get wallet to check ownership
    const wallet = await walletService.getWallet(walletId);
    
    // Check if user has permission to update this wallet
    if (wallet.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to update this wallet'
        }
      });
    }
    
    // Update wallet name
    const updatedWallet = await walletService.updateWalletName(walletId, value.name);
    
    return res.status(200).json({
      success: true,
      message: 'Wallet name updated successfully',
      data: updatedWallet
    });
  } catch (error) {
    if (error instanceof WalletError) {
      if (error.code === 'NOT_FOUND') {
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
    
    logger.error(`Update wallet name controller error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating wallet name'
      }
    });
  }
};