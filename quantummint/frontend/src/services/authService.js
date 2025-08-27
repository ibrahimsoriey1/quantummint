import api from './api';

const authService = {
  /**
   * Login user
   * @param {string} username - Username or email
   * @param {string} password - Password
   * @returns {Promise<Object>} Response data
   */
  login: async (username, password) => {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },

  /**
   * Register user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} Response data
   */
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  /**
   * Verify email
   * @param {string} userId - User ID
   * @param {string} token - Verification token
   * @returns {Promise<Object>} Response data
   */
  verifyEmail: async (userId, token) => {
    const response = await api.post('/auth/verify-email', { userId, token });
    return response.data;
  },

  /**
   * Verify two-factor authentication
   * @param {string} userId - User ID
   * @param {string} code - Verification code
   * @param {string} tempToken - Temporary token
   * @returns {Promise<Object>} Response data
   */
  verifyTwoFactor: async (userId, code, tempToken) => {
    const response = await api.post('/auth/verify-2fa', { userId, code, tempToken });
    return response.data;
  },

  /**
   * Refresh access token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} Response data
   */
  refreshToken: async (refreshToken) => {
    const response = await api.post('/auth/refresh-token', { refreshToken });
    return response.data;
  },

  /**
   * Logout user
   * @returns {Promise<Object>} Response data
   */
  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  /**
   * Request password reset
   * @param {string} email - User email
   * @returns {Promise<Object>} Response data
   */
  forgotPassword: async (email) => {
    const response = await api.post('/auth/reset-password-request', { email });
    return response.data;
  },

  /**
   * Reset password
   * @param {string} userId - User ID
   * @param {string} token - Reset token
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Response data
   */
  resetPassword: async (userId, token, newPassword) => {
    const response = await api.post('/auth/reset-password', { userId, token, newPassword });
    return response.data;
  },

  /**
   * Change password
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Response data
   */
  changePassword: async (currentPassword, newPassword) => {
    const response = await api.post('/users/change-password', { currentPassword, newPassword });
    return response.data;
  },

  /**
   * Update user profile
   * @param {Object} profileData - Profile data to update
   * @returns {Promise<Object>} Response data
   */
  updateProfile: async (profileData) => {
    const response = await api.put('/users/profile', profileData);
    return response.data;
  },

  /**
   * Enable two-factor authentication
   * @returns {Promise<Object>} Response data with QR code and secret
   */
  enableTwoFactor: async () => {
    const response = await api.post('/users/enable-2fa');
    return response.data;
  },

  /**
   * Verify two-factor authentication setup
   * @param {string} code - Verification code
   * @returns {Promise<Object>} Response data with recovery codes
   */
  verifyTwoFactorSetup: async (code) => {
    const response = await api.post('/users/verify-2fa-setup', { code });
    return response.data;
  },

  /**
   * Disable two-factor authentication
   * @param {string} password - User password
   * @returns {Promise<Object>} Response data
   */
  disableTwoFactor: async (password) => {
    const response = await api.post('/users/disable-2fa', { password });
    return response.data;
  },

  /**
   * Get user profile
   * @returns {Promise<Object>} Response data with user profile
   */
  getProfile: async () => {
    const response = await api.get('/users/profile');
    return response.data;
  }
};

export default authService;