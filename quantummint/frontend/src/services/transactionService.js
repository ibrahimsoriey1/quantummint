import api from './api';

const transactionService = {
  /**
   * Get transaction history
   * @param {Object} params - Query parameters
   * @param {string} params.walletId - Filter by wallet ID
   * @param {string} params.type - Filter by transaction type
   * @param {string} params.status - Filter by status
   * @param {number} params.page - Page number
   * @param {number} params.limit - Items per page
   * @param {string} params.startDate - Filter by start date
   * @param {string} params.endDate - Filter by end date
   * @returns {Promise<Object>} Response data
   */
  getTransactionHistory: async (params = {}) => {
    const response = await api.get('/transactions', { params });
    return response.data;
  },

  /**
   * Get transaction details
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Response data
   */
  getTransactionDetails: async (transactionId) => {
    const response = await api.get(`/transactions/${transactionId}`);
    return response.data;
  }
};

export default transactionService;