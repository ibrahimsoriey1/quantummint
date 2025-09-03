import axios from 'axios';
import { notify } from './notify';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const message = error?.response?.data?.message || error?.message || 'Request failed';
    try { notify(message, 'error'); } catch {}
    return Promise.reject(error);
  }
);


