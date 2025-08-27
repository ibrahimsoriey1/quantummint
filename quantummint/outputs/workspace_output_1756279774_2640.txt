import api from './api';

const kycService = {
  /**
   * Submit KYC information
   * @param {FormData} kycData - KYC form data with files
   * @returns {Promise<Object>} Response data
   */
  submitKYC: async (kycData) => {
    const response = await api.post('/users/kyc/submit', kycData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  /**
   * Get KYC status
   * @returns {Promise<Object>} Response data
   */
  getKYCStatus: async () => {
    const response = await api.get('/users/kyc/status');
    return response.data;
  }
};

export default kycService;