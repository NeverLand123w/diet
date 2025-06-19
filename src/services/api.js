import axios from 'axios';

// 1. Create the secure axios instance
const secureApi = axios.create({
    baseURL: '/api', // Your API base URL
});

// 2. Request Interceptor: Automatically add the JWT to every request
secureApi.interceptors.request.use((config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// 3. Response Interceptor: Automatically handle 401 errors (expired token)
secureApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.error("Authentication Error: Token is invalid or expired. Logging out.");
      localStorage.removeItem('admin_token');
      // Force a full redirect to the login page to clear all state
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default secureApi;