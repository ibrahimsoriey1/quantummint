import api from './api';

const generationService = {
  /**
   * Generate money
   * @param {string} walletId - Wallet ID
   * @param {number} amount - Amount to generate
   * @param {string} generationMethod - Generation method (standard, accelerated, premium)
   * @returns {Promise<Object>} Response data
   */
  generateMoney: async (walletId, amount, generationMethod) => {
    const response = await api.post('/generate', {
      walletId,
      amount,
      generationMethod
    });
    return response.data;
  },

  /**
   * Verify generation
   * @param {string} generationId - Generation ID
   * @param {string} verificationCode - Verification code
   * @returns {Promise<Object>} Response data
   */
  verifyGeneration: async (generationId, verificationCode) => {
    const response = await api.post('/generate/verify', {
      generationId,
      verificationCode
    });
    return response.data;
  },

  /**
   * Get generation status
   * @param {string} generationId - Generation ID
   * @returns {Promise<Object>} Response data
   */
  getGenerationStatus: async (generationId) => {
    const response = await api.get(`/generate/${generationId}`);
    return response.data;
  },

  /**
   * Get generation history
   * @param {Object} params - Query parameters
   * @param {number} params.page - Page number
   * @param {number} params.limit - Items per page
   * @param {string} params.status - Filter by status
   * @param {string} params.startDate - Filter by start date
   * @param {string} params.endDate - Filter by end date
   * @param {string} params.walletId - Filter by wallet ID
   * @returns {Promise<Object>} Response data
   */
  getGenerationHistory: async (params = {}) => {
    const response = await api.get('/generate/history', { params });
    return response.data;
  }
};

export default generationService;