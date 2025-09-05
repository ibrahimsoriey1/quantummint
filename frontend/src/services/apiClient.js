import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const api = axios.create({ baseURL: '/api', withCredentials: true });

// CSRF defaults (must match server)
api.defaults.xsrfCookieName = 'XSRF-TOKEN';
api.defaults.xsrfHeaderName = 'X-CSRF-Token';

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
    
    // Handle CSRF token errors
    if (error?.response?.status === 403 && error?.response?.data?.message?.includes('CSRF')) {
      // Try to refresh CSRF token and retry the request
      return api.get('/csrf-token').then(() => {
        // Retry the original request
        return api.request(error.config);
      }).catch(() => {
        return Promise.reject(error);
      });
    }
    
    return Promise.reject(error);
  }
);

export default api;


