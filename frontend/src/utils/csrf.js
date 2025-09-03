import api from '../services/apiClient';

export const initCsrf = async () => {
  try {
    await api.get('/csrf-token');
  } catch (e) {
    // noop
  }
};






