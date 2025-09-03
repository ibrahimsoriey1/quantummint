import axios from 'axios';
import { handleApiError } from '../utils/errorHandler';

const API_URL = '/api/generation';
const WALLET_URL = '/api/wallets';

// Create axios instance with token
const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Generate money
const generateMoney = async (generationData) => {
  try {
    const response = await axios.post(
      `${API_URL}`,
      generationData,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get generation history
const getGenerationHistory = async (page = 1, limit = 10) => {
  try {
    const response = await axios.get(
      `${API_URL}/history?page=${page}&limit=${limit}`,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get generation details
const getGenerationDetails = async (generationId) => {
  try {
    const response = await axios.get(
      `${API_URL}/${generationId}`,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get generation statistics
const getGenerationStats = async () => {
  try {
    const response = await axios.get(
      `${API_URL}/stats`,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get wallet balance
const getWalletBalance = async () => {
  try {
    const response = await axios.get(
      `${WALLET_URL}/balance`,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get wallet details
const getWalletDetails = async () => {
  try {
    const response = await axios.get(
      `${WALLET_URL}`,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Transfer money
const transferMoney = async (transferData) => {
  try {
    const response = await axios.post(
      `${WALLET_URL}/transfer`,
      transferData,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Withdraw money
const withdrawMoney = async (withdrawData) => {
  try {
    const response = await axios.post(
      `${WALLET_URL}/withdraw`,
      withdrawData,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Deposit money
const depositMoney = async (depositData) => {
  try {
    const response = await axios.post(
      `${WALLET_URL}/deposit`,
      depositData,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

const moneyGenerationService = {
  generateMoney,
  getGenerationHistory,
  getGenerationDetails,
  getGenerationStats,
  getWalletBalance,
  getWalletDetails,
  transferMoney,
  withdrawMoney,
  depositMoney,
};

export default moneyGenerationService;