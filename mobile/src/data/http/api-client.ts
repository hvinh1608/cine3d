import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { config } from '@/core/config';
import { ApiError, type ApiErrorPayload, type User } from '@/domain/models';
import { bumpSessionEpoch, getSessionEpoch } from '@/data/auth/session-epoch';
import { tokenStorage } from '@/data/auth/token-storage';
import { useAppStore } from '@/state/app-store';
import { redactErrorMessage } from '@/core/reliability';

type RetriableRequest = InternalAxiosRequestConfig & { _authRetried?: boolean };
interface RefreshResponse {
  accessToken: string;
  refreshToken?: string;
  user?: User;
}

export function toApiError(error: unknown): ApiError {
  if (!axios.isAxiosError<ApiErrorPayload>(error)) {
    return new ApiError(redactErrorMessage(error));
  }
  const status = error.response?.status;
  const payload = error.response?.data;
  const message = redactErrorMessage(
    payload?.message || (error.code === 'ECONNABORTED' ? 'Request timed out' : 'Network request failed'),
  );
  return new ApiError(message, status, payload?.code, !status || status >= 500 || status === 429);
}

export const apiClient = axios.create({
  baseURL: config.apiUrl,
  timeout: config.requestTimeoutMs,
  headers: {
    Accept: 'application/json',
    'X-Client-Type': 'mobile',
    ...(config.appAttestation ? { 'X-App-Attestation': config.appAttestation } : {}),
  },
});

let refreshFlight: Promise<string> | null = null;
let lastResumeSyncAt = 0;
const RESUME_SYNC_MIN_INTERVAL_MS = 10 * 60_000;

async function refreshAccessToken(): Promise<string> {
  if (refreshFlight) return refreshFlight;
  const epoch = getSessionEpoch();
  refreshFlight = (async () => {
    const stored = await tokenStorage.getTokens();
    if (!stored.refreshToken) throw new ApiError('Session expired', 401, 'SESSION_EXPIRED');

    const { data } = await axios.post<RefreshResponse>(
      `${config.apiUrl}/auth/refresh`,
      { refreshToken: stored.refreshToken },
      {
        timeout: config.requestTimeoutMs,
        headers: {
          Accept: 'application/json',
          'X-Client-Type': 'mobile',
          ...(config.appAttestation ? { 'X-App-Attestation': config.appAttestation } : {}),
        },
      },
    );
    if (!data.accessToken) throw new ApiError('Invalid refresh response', 401, 'SESSION_EXPIRED');
    if (epoch !== getSessionEpoch()) throw new ApiError('Session superseded', 401, 'SESSION_EXPIRED');

    const nextRefreshToken = data.refreshToken ?? stored.refreshToken;
    // Abort before writing storage if the user logged out mid-flight.
    if (epoch !== getSessionEpoch()) throw new ApiError('Session superseded', 401, 'SESSION_EXPIRED');
    await tokenStorage.saveTokens({ accessToken: data.accessToken, refreshToken: nextRefreshToken });
    if (epoch !== getSessionEpoch()) {
      await tokenStorage.clear().catch(() => undefined);
      throw new ApiError('Session superseded', 401, 'SESSION_EXPIRED');
    }

    useAppStore.setState((state) => ({
      session: {
        ...state.session,
        tokens: { accessToken: data.accessToken, refreshToken: nextRefreshToken },
      },
    }));
    if (data.user) useAppStore.getState().setUser(data.user);
    return data.accessToken;
  })().finally(() => {
    refreshFlight = null;
  });
  return refreshFlight;
}

export async function syncSessionOnResume(force = false): Promise<void> {
  const refreshToken = useAppStore.getState().session.tokens.refreshToken;
  if (!refreshToken) return;
  const now = Date.now();
  if (!force && now - lastResumeSyncAt < RESUME_SYNC_MIN_INTERVAL_MS) return;
  lastResumeSyncAt = now;
  try {
    await refreshAccessToken();
  } catch (error) {
    const apiError = toApiError(error);
    if (apiError.status === 401 || apiError.status === 403) {
      await useAppStore.getState().logout();
    }
  }
}

apiClient.interceptors.request.use(async (request) => {
  const state = useAppStore.getState();
  const accessToken = state.session.tokens.accessToken ?? (await tokenStorage.getTokens()).accessToken;
  if (accessToken) request.headers.Authorization = `Bearer ${accessToken}`;
  if (state.session.activeProfile?.id) {
    request.headers['X-Profile-Id'] = state.session.activeProfile.id;
  }
  return request;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorPayload>) => {
    const request = error.config as RetriableRequest | undefined;
    const isAuthEndpoint = request?.url?.includes('/auth/login') || request?.url?.includes('/auth/refresh');
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const shouldRefresh = status === 401
      || (status === 403 && (code === 'TOKEN_EXPIRED' || code === 'SESSION_EXPIRED'));
    if (shouldRefresh && request && !request._authRetried && !isAuthEndpoint) {
      request._authRetried = true;
      try {
        request.headers.Authorization = `Bearer ${await refreshAccessToken()}`;
        return await apiClient(request);
      } catch (refreshError) {
        const apiError = toApiError(refreshError);
        if (apiError.status === 401 || apiError.status === 403) {
          await useAppStore.getState().logout();
        }
        throw apiError;
      }
    }
    throw toApiError(error);
  },
);
