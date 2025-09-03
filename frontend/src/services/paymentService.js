import api from './apiClient';
import { handleApiError } from '../utils/errorHandler';

const API_URL = '/payments';
const PROVIDERS_URL = '/providers';

// apiClient attaches auth header automatically

// Get active payment providers
const getActiveProviders = async () => {
  try {
    const response = await api.get(
      `${PROVIDERS_URL}/active`
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get payment provider details
const getProviderDetails = async (providerCode) => {
  try {
    const response = await api.get(
      `${PROVIDERS_URL}/${providerCode}`
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get provider fee structure
const getProviderFeeStructure = async (providerCode) => {
  try {
    const response = await api.get(
      `${PROVIDERS_URL}/${providerCode}/fee-structure`
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Calculate payment fee
const calculateFee = async (providerCode, amount) => {
  try {
    const response = await api.post(
      `${PROVIDERS_URL}/${providerCode}/calculate-fee`,
      { amount }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Create payment
const createPayment = async (paymentData, idempotencyKey) => {
  try {
    const response = await api.post(
      `${API_URL}`,
      paymentData,
      { headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {} }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get payment details
const getPaymentDetails = async (paymentId) => {
  try {
    const response = await api.get(
      `${API_URL}/${paymentId}`,
      { }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get payment history
const getPaymentHistory = async (page = 1, limit = 10, filters = {}) => {
  try {
    let queryParams = `page=${page}&limit=${limit}`;
    
    // Add filters to query params
    if (filters.status) queryParams += `&status=${filters.status}`;
    if (filters.provider) queryParams += `&provider=${filters.provider}`;
    if (filters.startDate) queryParams += `&startDate=${filters.startDate}`;
    if (filters.endDate) queryParams += `&endDate=${filters.endDate}`;
    
    const response = await api.get(
      `${API_URL}/history?${queryParams}`,
      { }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Cancel payment
const cancelPayment = async (paymentId) => {
  try {
    const response = await api.post(
      `${API_URL}/${paymentId}/cancel`,
      {}
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Verify payment
const verifyPayment = async (paymentId) => {
  try {
    const response = await api.get(
      `${API_URL}/${paymentId}/verify`,
      { }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get payment methods
const getPaymentMethods = async () => {
  try {
    const response = await api.get(
      `${API_URL}/methods`,
      { }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Add payment method
const addPaymentMethod = async (methodData) => {
  try {
    const response = await api.post(
      `${API_URL}/methods`,
      methodData,
      { }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Remove payment method
const removePaymentMethod = async (methodId) => {
  try {
    const response = await api.delete(
      `${API_URL}/methods/${methodId}`,
      { }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Set default payment method
const setDefaultPaymentMethod = async (methodId) => {
  try {
    const response = await api.put(
      `${API_URL}/methods/${methodId}/default`,
      {}
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

const paymentService = {
  getActiveProviders,
  getProviderDetails,
  getProviderFeeStructure,
  calculateFee,
  createPayment,
  getPaymentDetails,
  getPaymentHistory,
  cancelPayment,
  verifyPayment,
  getPaymentMethods,
  addPaymentMethod,
  removePaymentMethod,
  setDefaultPaymentMethod,
};

export default paymentService;