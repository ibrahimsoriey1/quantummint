import api from './api';

const adminService = {
  /**
   * Get all users
   * @param {Object} params - Query parameters
   * @param {number} params.page - Page number
   * @param {number} params.limit - Items per page
   * @param {string} params.status - Filter by status
   * @param {string} params.search - Search by username, email, or name
   * @returns {Promise<Object>} Response data
   */
  getAllUsers: async (params = {}) => {
    const response = await api.get('/admin/users', { params });
    return response.data;
  },

  /**
   * Get user details
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Response data
   */
  getUserDetails: async (userId) => {
    const response = await api.get(`/admin/users/${userId}`);
    return response.data;
  },

  /**
   * Update user status
   * @param {string} userId - User ID
   * @param {string} status - New status (active, inactive, suspended)
   * @param {string} reason - Reason for status change
   * @returns {Promise<Object>} Response data
   */
  updateUserStatus: async (userId, status, reason) => {
    const response = await api.put(`/admin/users/${userId}/status`, { status, reason });
    return response.data;
  },

  /**
   * Review KYC submission
   * @param {string} verificationId - Verification ID
   * @param {string} status - New status (verified, rejected)
   * @param {string} notes - Review notes
   * @param {string} rejectionReason - Reason for rejection (required if status is rejected)
   * @returns {Promise<Object>} Response data
   */
  reviewKYC: async (verificationId, status, notes, rejectionReason) => {
    const response = await api.put(`/admin/kyc/${verificationId}/review`, {
      status,
      notes,
      rejectionReason
    });
    return response.data;
  },

  /**
   * Get system statistics
   * @param {string} period - Time period (daily, weekly, monthly, yearly)
   * @returns {Promise<Object>} Response data
   */
  getSystemStatistics: async (period = 'daily') => {
    const response = await api.get('/admin/statistics', { params: { period } });
    return response.data;
  },

  /**
   * Get pending KYC verifications
   * @param {Object} params - Query parameters
   * @param {number} params.page - Page number
   * @param {number} params.limit - Items per page
   * @returns {Promise<Object>} Response data
   */
  getPendingKYC: async (params = {}) => {
    const response = await api.get('/admin/kyc', {
      params: { ...params, status: 'pending' }
    });
    return response.data;
  }
};

export default adminService;