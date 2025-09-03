import api from './apiClient';
import { handleApiError } from '../utils/errorHandler';

const API_URL = '/api/auth';
const USER_URL = '/api/users';
const TFA_URL = '/api/2fa';

// Create axios instance with token
const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Register user
const register = async (userData) => {
  try {
    const response = await api.post(`${API_URL}/register`, userData);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Login user
const login = async (credentials) => {
  try {
    const response = await api.post(`${API_URL}/login`, credentials);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Logout user
const logout = async () => {
  try {
    await api.post(
      `${API_URL}/logout`,
      {},
      { }
    );
    localStorage.removeItem('token');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Verify email
const verifyEmail = async (token) => {
  try {
    const response = await api.get(`${API_URL}/verify-email/${token}`);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Forgot password
const forgotPassword = async (email) => {
  try {
    const response = await api.post(`${API_URL}/forgot-password`, { email });
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Reset password
const resetPassword = async (token, password) => {
  try {
    const response = await api.post(`${API_URL}/reset-password/${token}`, {
      password,
      confirmPassword: password,
    });
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get current user
const getCurrentUser = async () => {
  try {
    const response = await api.get(`${USER_URL}/profile`);
    return response.data.user;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Update user profile
const updateProfile = async (userData) => {
  try {
    const response = await api.put(
      `${USER_URL}/profile`,
      userData,
      { }
    );
    return response.data.user;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Change password
const changePassword = async (passwordData) => {
  try {
    const response = await api.put(
      `${USER_URL}/change-password`,
      passwordData,
      { }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Verify two-factor authentication
const verifyTwoFactor = async (email, code) => {
  try {
    const response = await api.post(`${TFA_URL}/verify`, { email, code });
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Setup two-factor authentication
const setupTwoFactor = async () => {
  try {
    const response = await api.post(
      `${TFA_URL}/setup`,
      {},
      { }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Enable two-factor authentication
const enableTwoFactor = async (code) => {
  try {
    const response = await api.post(
      `${TFA_URL}/enable`,
      { code },
      { }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Disable two-factor authentication
const disableTwoFactor = async (code) => {
  try {
    const response = await api.post(
      `${TFA_URL}/disable`,
      { code },
      { }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get backup codes
const getBackupCodes = async () => {
  try {
    const response = await api.get(
      `${TFA_URL}/backup-codes`,
      { }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Generate new backup codes
const generateBackupCodes = async () => {
  try {
    const response = await api.post(
      `${TFA_URL}/backup-codes/generate`,
      {},
      { }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

const authService = {
  register,
  login,
  logout,
  verifyEmail,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  updateProfile,
  changePassword,
  verifyTwoFactor,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  getBackupCodes,
  generateBackupCodes,
};

export default authService;