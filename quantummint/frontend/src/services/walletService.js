import api from './api';

const walletService = {
  /**
   * Get user wallets
   * @returns {Promise<Object>} Response data with wallets
   */
  getUserWallets: async () => {
    const response = await api.get('/wallets');
    return response.data;
  },

  /**
   * Get wallet details
   * @param {string} walletId - Wallet ID
   * @returns {Promise<Object>} Response data with wallet details
   */
  getWalletDetails: async (walletId) => {
    const response = await api.get(`/wallets/${walletId}`);
    return response.data;
  }
};

export default walletService;