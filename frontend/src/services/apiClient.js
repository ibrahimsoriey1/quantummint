import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Attach Request ID
  if (!config.headers['X-Request-Id']) {
    config.headers['X-Request-Id'] = uuidv4();
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Global 401 handling: logout on unauthorized
    if (error?.response?.status === 401) {
      localStorage.removeItem('token');
      // Let callers handle redirect via context
    }
    return Promise.reject(error);
  }
);

export default api;


