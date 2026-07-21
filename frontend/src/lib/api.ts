import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useStore } from '../hooks/useStore';
import { rewriteImageUrls } from './image-url';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const api = axios.create({ baseURL: API_URL, timeout: 20_000, withCredentials: true });

let refreshRequest: Promise<string> | null = null;
let sessionEpoch = 0;
let loggingOut = false;

export function bumpSessionEpoch(): number {
  sessionEpoch += 1;
  refreshRequest = null;
  return sessionEpoch;
}

export function isAuthFailure(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === 401 || status === 403;
}

/** Prefer 401 for expired tokens; keep 403 only when backend still emits it for JWT expiry. */
function shouldAttemptRefresh(status?: number, code?: string): boolean {
  if (status === 401) return true;
  if (status === 403 && (code === 'TOKEN_EXPIRED' || code === 'SESSION_EXPIRED')) return true;
  // Legacy backend: expired access JWT returned 403 without a code.
  if (status === 403 && !code) return true;
  return false;
}

export async function logoutOnce(): Promise<void> {
  if (loggingOut) return;
  loggingOut = true;
  try {
    bumpSessionEpoch();
    useStore.getState().logout();
  } finally {
    loggingOut = false;
  }
}

/** Single in-flight refresh so reload/StrictMode cannot rotate the cookie twice. */
export async function refreshSession(): Promise<string> {
  if (refreshRequest) return refreshRequest;

  const epoch = sessionEpoch;
  refreshRequest = axios
    .post(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
    .then(({ data }) => {
      // Ignore late refresh results after logout / epoch bump.
      if (epoch !== sessionEpoch) {
        throw Object.assign(new Error('Session superseded'), { response: { status: 401 } });
      }
      useStore.getState().setSession(data.user, data.accessToken);
      return data.accessToken as string;
    })
    .finally(() => {
      refreshRequest = null;
    });

  return refreshRequest;
}

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
  (response) => { response.data = rewriteImageUrls(response.data); return response; },
  async (error: AxiosError<{ code?: string }>) => {
    const original = error.config as (InternalAxiosRequestConfig & { _authRetried?: boolean }) | undefined;
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const isAuthRoute = /\/auth\/(login|register|google|facebook|refresh|logout)/.test(original?.url || '');
    const user = useStore.getState().user;

    if (!original || original._authRetried || isAuthRoute || !user || !shouldAttemptRefresh(status, code)) {
      return Promise.reject(error);
    }

    original._authRetried = true;
    try {
      const accessToken = await refreshSession();
      original.headers.Authorization = `Bearer ${accessToken}`;
      return api(original);
    } catch (refreshError) {
      if (isAuthFailure(refreshError)) {
        await logoutOnce();
      }
      return Promise.reject(refreshError);
    }
  },
);

export default api;
