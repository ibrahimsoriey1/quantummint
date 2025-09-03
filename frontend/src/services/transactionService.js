import axios from 'axios';
import { handleApiError } from '../utils/errorHandler';

const API_URL = '/api/transactions';
const BALANCE_URL = '/api/balances';

// Create axios instance with token
const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Get all transactions
const getTransactions = async (page = 1, limit = 10, filters = {}) => {
  try {
    let queryParams = `page=${page}&limit=${limit}`;
    
    // Add filters to query params
    if (filters.type) queryParams += `&type=${filters.type}`;
    if (filters.status) queryParams += `&status=${filters.status}`;
    if (filters.startDate) queryParams += `&startDate=${filters.startDate}`;
    if (filters.endDate) queryParams += `&endDate=${filters.endDate}`;
    if (filters.minAmount) queryParams += `&minAmount=${filters.minAmount}`;
    if (filters.maxAmount) queryParams += `&maxAmount=${filters.maxAmount}`;
    
    const response = await axios.get(
      `${API_URL}?${queryParams}`,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get transaction details
const getTransactionDetails = async (transactionId) => {
  try {
    const response = await axios.get(
      `${API_URL}/${transactionId}`,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get transaction receipt
const getTransactionReceipt = async (transactionId) => {
  try {
    const response = await axios.get(
      `${API_URL}/${transactionId}/receipt`,
      { 
        headers: getAuthHeader(),
        responseType: 'blob'
      }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get transaction statistics
const getTransactionStats = async (period = 'month') => {
  try {
    const response = await axios.get(
      `${API_URL}/stats?period=${period}`,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get balance history
const getBalanceHistory = async (period = 'month') => {
  try {
    const response = await axios.get(
      `${BALANCE_URL}/history?period=${period}`,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get current balance
const getCurrentBalance = async () => {
  try {
    const response = await axios.get(
      `${BALANCE_URL}/current`,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get balance forecast
const getBalanceForecast = async (months = 3) => {
  try {
    const response = await axios.get(
      `${BALANCE_URL}/forecast?months=${months}`,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

const transactionService = {
  getTransactions,
  getTransactionDetails,
  getTransactionReceipt,
  getTransactionStats,
  getBalanceHistory,
  getCurrentBalance,
  getBalanceForecast,
};

export default transactionService;