import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { Profile, User } from '@/domain/models';
import { apiClient } from '@/data/http/api-client';
import { tokenStorage } from '@/data/auth/token-storage';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: User;
  message?: string;
}
export interface SessionDevice {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  lastUsedAt: string;
  expiresAt: string;
  current: boolean;
}
export interface AccountNotification {
  id: string;
  title: string;
  message: string;
  type?: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}
export interface Feedback {
  id: string;
  category: string;
  subject: string;
  content: string;
  status: string;
  adminReply?: string | null;
  repliedAt?: string | null;
  createdAt: string;
}
export interface VipPlan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  price: number;
  durationDays: number;
}
export interface VipOrder {
  id: string;
  orderCode: string;
  amount: number;
  status: string;
  createdAt: string;
  plan: Pick<VipPlan, 'id' | 'code' | 'name'>;
}

export const accountApi = {
  async login(email: string, password: string) {
    return (await apiClient.post<AuthSession>('/auth/login', { email, password })).data;
  },
  async register(email: string, username: string, password: string) {
    return (await apiClient.post<AuthSession & { requiresVerification?: boolean }>('/auth/register', { email, username, password })).data;
  },
  async google(credential: string, avatar?: string | null) {
    return (await apiClient.post<AuthSession>('/auth/google', {
      credential,
      ...(avatar ? { avatar } : {}),
    })).data;
  },
  async forgotPassword(email: string) {
    return (await apiClient.post<{ message: string }>('/auth/forgot-password', { email })).data;
  },
  async resetPassword(token: string, newPassword: string) {
    return (await apiClient.post<{ message: string }>('/auth/reset-password', { token, newPassword })).data;
  },
  async verifyEmail(token: string) {
    return (await apiClient.post<{ message: string; verified: boolean }>('/auth/verify-email', { token })).data;
  },
  async me() {
    return (await apiClient.get<{ user: User }>('/auth/me')).data.user;
  },
  async logout(refreshToken?: string) {
    await apiClient.post('/auth/logout', { refreshToken });
  },
  async updateUser(input: { username?: string; avatar?: string }) {
    return (await apiClient.put<{ user: User }>('/user/profile', input)).data.user;
  },
  async uploadAvatar(uri: string, mimeType = 'image/jpeg') {
    const data = new FormData();
    data.append('avatar', { uri, name: `avatar.${mimeType.split('/')[1] || 'jpg'}`, type: mimeType } as unknown as Blob);
    return (await apiClient.post<{ user: User }>('/user/profile/avatar-upload', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data.user;
  },
  async profiles() { return (await apiClient.get<Profile[]>('/user/profiles')).data; },
  async createProfile(input: { name: string; avatar?: string; isKids: boolean; pin?: string }) {
    return (await apiClient.post<Profile>('/user/profiles', input)).data;
  },
  async updateProfile(id: string, input: Partial<{ name: string; avatar: string; isKids: boolean; pin: string }>) {
    return (await apiClient.put<Profile>(`/user/profiles/${id}`, input)).data;
  },
  async verifyPin(id: string, pin: string) {
    return (await apiClient.post<{ valid: boolean }>(`/user/profiles/${id}/verify-pin`, { pin })).data.valid;
  },
  async deleteProfile(id: string) { await apiClient.delete(`/user/profiles/${id}`); },
  async sessions() {
    const refreshToken = (await tokenStorage.getTokens()).refreshToken;
    return (await apiClient.get<SessionDevice[]>('/auth/sessions', { headers: refreshToken ? { 'X-Refresh-Token': refreshToken } : {} })).data;
  },
  async revokeSession(id: string) { await apiClient.delete(`/auth/sessions/${id}`); },
  async revokeOthers() {
    const refreshToken = (await tokenStorage.getTokens()).refreshToken;
    return (await apiClient.delete<{ message: string }>('/auth/sessions/others', { headers: refreshToken ? { 'X-Refresh-Token': refreshToken } : {} })).data;
  },
  async notifications() { return (await apiClient.get<AccountNotification[]>('/user/notifications')).data; },
  async readNotification(id: string) { await apiClient.put(`/user/notifications/${id}/read`); },
  async readAllNotifications() { await apiClient.put('/user/notifications/read-all'); },
  async feedback() { return (await apiClient.get<Feedback[]>('/feedback/me')).data; },
  async createFeedback(input: { category: string; subject: string; content: string }) {
    return (await apiClient.post<{ feedback: Feedback; message: string }>('/feedback', input)).data;
  },
  async deleteAccount(input: { confirmation: 'DELETE_MY_ACCOUNT'; password?: string }) {
    return (await apiClient.delete<{ deleted: boolean; message: string }>('/user/account', { data: input })).data;
  },
  async plans() { return (await apiClient.get<{ plans: VipPlan[] }>('/vip/plans')).data.plans; },
  async vipHistory() {
    return (await apiClient.get<{ vip: { active: boolean; expiresAt: string | null; permanent: boolean }; orders: VipOrder[] }>('/vip/orders/me')).data;
  },
  async verifyGooglePurchase(productId: string, purchaseToken: string) {
    return (await apiClient.post<{ purchase: { status: string; expiryTime: string } }>('/billing/google/verify', { productId, purchaseToken })).data;
  },
  async versionPolicy() {
    return (await apiClient.get<{ policy: { minVersion: string; latestVersion: string; forceUpdate: boolean; message?: string; storeUrl?: string } }>(
      '/app/version',
      { params: { platform: Platform.OS } },
    )).data.policy;
  },
  appVersion: Constants.expoConfig?.version || '1.0.0',
};
