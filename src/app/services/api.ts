import axios from 'axios';

const getBaseUrl = () => {
  // Point to the live remote API so local frontend can be tested without a local MySQL db
  // return 'http://20.244.43.1/api';
  //return `http://${window.location.hostname}:8000/api`;
  return '/api';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthEndpoint = typeof error.config?.url === 'string' && error.config.url.includes('/users/token');
    if (error.response?.status === 401 && !isAuthEndpoint) {
      sessionStorage.removeItem('token');
      // Ideally redirect to login, but let's let the App component handle it via state
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;
