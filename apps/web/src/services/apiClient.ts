import axios, { AxiosError } from 'axios';
import { useAuthStore } from '../stores/authStore.js';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: inject correlation ID and active facility header
apiClient.interceptors.request.use((config) => {
  const activeFacilityId = useAuthStore.getState().user?.activeFacilityId;
  if (activeFacilityId) {
    config.headers['X-Facility-Id'] = activeFacilityId;
  }
  return config;
});

// Response Interceptor: handle 401 token refresh automatically
let isRefreshing = false;
let failedQueue: Array<{ resolve: (val?: unknown) => void; reject: (err: unknown) => void }> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    // Don't loop refresh on /auth/refresh or /auth/login
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/mfa')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => apiClient(originalRequest));
      }

      isRefreshing = true;

      try {
        await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
        processQueue(null);
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr);
        useAuthStore.getState().logout();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
