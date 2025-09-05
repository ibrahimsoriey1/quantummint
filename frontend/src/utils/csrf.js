import api from '../services/apiClient';

export const initCsrf = async () => {
  try {
    const response = await api.get('/csrf-token');
    console.log('CSRF token initialized:', response.data);
  } catch (e) {
    console.warn('Failed to initialize CSRF token:', e.message);
  }
};

export const refreshCsrf = async () => {
  try {
    const response = await api.get('/csrf-token');
    return response.data;
  } catch (e) {
    console.error('Failed to refresh CSRF token:', e.message);
    throw e;
  }
};












