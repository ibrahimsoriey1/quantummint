const Wallet = require('../models/wallet.model');
const { publishEvent } = require('../utils/event.util');
const { WalletError } = require('../utils/errors.util');
const logger = require('../utils/logger.util');

/**
 * Wallet Service
 * Handles wallet operations
 */
class WalletService {
  /**
   * Create a new wallet
   * @param {Object} walletData - Wallet data
   * @returns {Promise<Object>} Created wallet
   */
  async createWallet(walletData) {
    try {
      const {
        userId,
        currency = 'USD',
        walletType = 'personal',
        name = 'Default Wallet',
        metadata = {}
      } = walletData;
      
      // Check if user already has a wallet with this currency and type
      const existingWallet = await Wallet.findOne({
        userId,
        currency,
        walletType
      });
      
      if (existingWallet) {
        throw new WalletError('User already has a wallet with this currency and type', 'DUPLICATE_WALLET');
      }
      
      // Create wallet
      const wallet = new Wallet({
        userId,
        currency,
        walletType,
        name,
        balance: 0,
        status: 'active',
        metadata
      });
      
      await wallet.save();
      
      // Publish wallet created event
      await publishEvent('wallet.created', {
        walletId: wallet._id.toString(),
        userId,
        currency,
        walletType,
        name
      });
      
      logger.info(`Wallet created: ${wallet._id} for user ${userId}`);
      
      return {
        walletId: wallet._id.toString(),
        userId,
        currency,
        walletType,
        name,
        balance: wallet.balance,
        status: wallet.status,
        createdAt: wallet.createdAt
      };
    } catch (error) {
      if (error instanceof WalletError) {
        throw error;
      }
      
      logger.error(`Wallet creation error: ${error.message}`);
      throw new WalletError('Failed to create wallet', 'CREATION_FAILED');
    }
  }
  
  /**
   * Get wallet by ID
   * @param {string} walletId - Wallet ID
   * @returns {Promise<Object>} Wallet details
   */
  async getWallet(walletId) {
    try {
      const wallet = await Wallet.findById(walletId);
      
      if (!wallet) {
        throw new WalletError('Wallet not found', 'NOT_FOUND');
      }
      
      return {
        walletId: wallet._id.toString(),
        userId: wallet.userId.toString(),
        currency: wallet.currency,
        walletType: wallet.walletType,
        name: wallet.name,
        balance: wallet.balance,
        status: wallet.status,
        metadata: wallet.metadata,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt
      };
    } catch (error) {
      if (error instanceof WalletError) {
        throw error;
      }
      
      logger.error(`Get wallet error: ${error.message}`);
      throw new WalletError('Failed to get wallet', 'RETRIEVAL_FAILED');
    }
  }
  
  /**
   * Get wallets for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} User wallets
   */
  async getUserWallets(userId) {
    try {
      const wallets = await Wallet.find({ userId });
      
      return wallets.map(wallet => ({
        walletId: wallet._id.toString(),
        currency: wallet.currency,
        walletType: wallet.walletType,
        name: wallet.name,
        balance: wallet.balance,
        status: wallet.status,
        createdAt: wallet.createdAt
      }));
    } catch (error) {
      logger.error(`Get user wallets error: ${error.message}`);
      throw new WalletError('Failed to get user wallets', 'RETRIEVAL_FAILED');
    }
  }
  
  /**
   * Update wallet status
   * @param {string} walletId - Wallet ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated wallet
   */
  async updateWalletStatus(walletId, status) {
    try {
      const wallet = await Wallet.findById(walletId);
      
      if (!wallet) {
        throw new WalletError('Wallet not found', 'NOT_FOUND');
      }
      
      // Update status
      wallet.status = status;
      await wallet.save();
      
      // Publish wallet updated event
      await publishEvent('wallet.updated', {
        walletId: wallet._id.toString(),
        userId: wallet.userId.toString(),
        status
      });
      
      logger.info(`Wallet status updated: ${walletId} to ${status}`);
      
      return {
        walletId: wallet._id.toString(),
        status: wallet.status,
        updatedAt: wallet.updatedAt
      };
    } catch (error) {
      if (error instanceof WalletError) {
        throw error;
      }
      
      logger.error(`Update wallet status error: ${error.message}`);
      throw new WalletError('Failed to update wallet status', 'UPDATE_FAILED');
    }
  }

  /**
   * Update wallet name
   * @param {string} walletId - Wallet ID
   * @param {string} name - New name
   * @returns {Promise<Object>} Updated wallet
   */
  async updateWalletName(walletId, name) {
    try {
      const wallet = await Wallet.findById(walletId);
      
      if (!wallet) {
        throw new WalletError('Wallet not found', 'NOT_FOUND');
      }
      
      // Update name
      wallet.name = name;
      await wallet.save();
      
      logger.info(`Wallet name updated: ${walletId} to ${name}`);
      
      return {
        walletId: wallet._id.toString(),
        name: wallet.name,
        updatedAt: wallet.updatedAt
      };
    } catch (error) {
      if (error instanceof WalletError) {
        throw error;
      }
      
      logger.error(`Update wallet name error: ${error.message}`);
      throw new WalletError('Failed to update wallet name', 'UPDATE_FAILED');
    }
  }
}

module.exports = new WalletService();