import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useStore } from '../hooks/useStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const api = axios.create({ baseURL: API_URL, timeout: 20_000, withCredentials: true });
let refreshRequest: Promise<string> | null = null;

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useStore.getState().accessToken;
  const profileId = useStore.getState().selectedProfileId;
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (profileId && !config.headers['X-Profile-Id']) {
    config.headers['X-Profile-Id'] = profileId;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error.response?.status;
    const isAuthRoute = /\/auth\/(login|register|google|refresh|logout)/.test(original?.url || '');
    const user = useStore.getState().user;

    if (!original || original._retried || isAuthRoute || !user || (status !== 401 && status !== 403)) {
      return Promise.reject(error);
    }

    original._retried = true;
    try {
      refreshRequest ??= axios
        .post(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
        .then(({ data }) => {
          useStore.getState().setSession(data.user, data.accessToken);
          return data.accessToken as string;
        })
        .finally(() => {
          refreshRequest = null;
        });

      const accessToken = await refreshRequest;
      original.headers.Authorization = `Bearer ${accessToken}`;
      return api(original);
    } catch (refreshError) {
      useStore.getState().logout();
      return Promise.reject(refreshError);
    }
  }
);

export default api;
