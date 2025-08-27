import api from './api';

const cashOutService = {
  /**
   * Get available payment providers
   * @returns {Promise<Object>} Response data
   */
  getPaymentProviders: async () => {
    const response = await api.get('/cashout/providers');
    return response.data;
  },

  /**
   * Initiate cash out
   * @param {Object} cashOutData - Cash out data
   * @param {string} cashOutData.walletId - Wallet ID
   * @param {number} cashOutData.amount - Amount to cash out
   * @param {string} cashOutData.provider - Provider (orange_money, afrimoney, stripe)
   * @param {string} cashOutData.providerAccountId - Provider account ID
   * @param {string} cashOutData.providerAccountName - Provider account name
   * @returns {Promise<Object>} Response data
   */
  initiateCashOut: async (cashOutData) => {
    const response = await api.post('/cashout/initiate', cashOutData);
    return response.data;
  },

  /**
   * Get cash out status
   * @param {string} cashOutId - Cash out ID
   * @returns {Promise<Object>} Response data
   */
  getCashOutStatus: async (cashOutId) => {
    const response = await api.get(`/cashout/${cashOutId}`);
    return response.data;
  },

  /**
   * Get cash out history
   * @param {Object} params - Query parameters
   * @param {string} params.walletId - Filter by wallet ID
   * @param {string} params.provider - Filter by provider
   * @param {string} params.status - Filter by status
   * @param {number} params.page - Page number
   * @param {number} params.limit - Items per page
   * @param {string} params.startDate - Filter by start date
   * @param {string} params.endDate - Filter by end date
   * @returns {Promise<Object>} Response data
   */
  getCashOutHistory: async (params = {}) => {
    const response = await api.get('/cashout/history', { params });
    return response.data;
  }
};

export default cashOutService;