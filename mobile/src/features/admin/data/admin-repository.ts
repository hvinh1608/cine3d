import { apiClient } from '@/data/http/api-client';
import type {
  AdminFeedback, AdminMovie, AdminReport, AdminStats, AdminUser, AdminVipOrder, AnalyticsEvent, AnalyticsSummary, SourceHealth,
  BulkEpisodeInput, EpisodeInput, MetaEntity, MovieInput, MoviePage, SourceHealthResponse,
} from '../domain/types';

const array = <T>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
const message = (value: unknown, fallback: string) =>
  typeof value === 'object' && value !== null && 'message' in value && typeof value.message === 'string' ? value.message : fallback;

function normalizeMovie(raw: AdminMovie): AdminMovie {
  return {
    ...raw,
    episodes: array(raw.episodes),
    movieGenres: array(raw.movieGenres),
    isFeatured: Boolean(raw.isFeatured), isTrending: Boolean(raw.isTrending), isProposed: Boolean(raw.isProposed),
    isVip: Boolean(raw.isVip), isSeries: Boolean(raw.isSeries), isDubbed: Boolean(raw.isDubbed),
  };
}
function normalizeUser(raw: AdminUser & { role?: AdminUser['role'] | string }): AdminUser {
  return { ...raw, role: typeof raw.role === 'string' ? { name: raw.role as 'USER' | 'ADMIN' } : raw.role || { name: 'USER' } };
}

export const adminRepository = {
  async stats() { return (await apiClient.get<AdminStats>('/admin/stats')).data; },
  async analytics() {
    const data = (await apiClient.get<AnalyticsSummary>('/admin/analytics')).data;
    return { ...data, events: data.events || {}, recentPlayerErrors: array<AnalyticsEvent>(data.recentPlayerErrors), recentQualityEvents: array<AnalyticsEvent>(data.recentQualityEvents) };
  },
  async movies(page = 1, search = '') {
    const data = (await apiClient.get<MoviePage>('/admin/movies', { params: { page, limit: 20, search: search.trim() || undefined } })).data;
    return { ...data, movies: array<AdminMovie>(data.movies).map(normalizeMovie), totalPages: data.totalPages || 1 };
  },
  async countries() { return array<MetaEntity>((await apiClient.get<MetaEntity[]>('/admin/countries')).data); },
  async genres() { return array<MetaEntity>((await apiClient.get<MetaEntity[]>('/admin/genres')).data); },
  async createMovie(input: MovieInput) { return (await apiClient.post('/admin/movies', input)).data; },
  async updateMovie(id: string, input: MovieInput) { return (await apiClient.put(`/admin/movies/${id}`, input)).data; },
  async deleteMovie(id: string) { return (await apiClient.delete(`/admin/movies/${id}`)).data; },
  async createEpisode(input: EpisodeInput) { return (await apiClient.post('/admin/episodes', input)).data; },
  async updateEpisode(id: string, input: Omit<EpisodeInput, 'movieId'>) { return (await apiClient.put(`/admin/episodes/${id}`, input)).data; },
  async deleteEpisode(id: string) { return (await apiClient.delete(`/admin/episodes/${id}`)).data; },
  async bulkEpisodes(movieId: string, episodes: BulkEpisodeInput[]) {
    const data = (await apiClient.post('/admin/episodes/bulk', { movieId, episodes })).data;
    return message(data, `Đã nhập ${episodes.length} tập.`);
  },
  async users() { return array<AdminUser>((await apiClient.get<AdminUser[]>('/admin/users')).data).map(normalizeUser); },
  async toggleLock(id: string) { return message((await apiClient.put(`/admin/users/${id}/lock`)).data, 'Đã cập nhật khóa tài khoản.'); },
  async toggleVip(id: string) { return message((await apiClient.put(`/admin/users/${id}/vip`)).data, 'Đã cập nhật VIP.'); },
  async updateRole(id: string, roleName: 'USER' | 'ADMIN') { return message((await apiClient.put(`/admin/users/${id}/role`, { roleName })).data, 'Đã cập nhật vai trò.'); },
  async orders() { return array<AdminVipOrder>((await apiClient.get<AdminVipOrder[]>('/admin/vip-orders')).data); },
  async confirmOrder(id: string) { return message((await apiClient.post(`/admin/vip-orders/${id}/confirm`)).data, 'Đã xác nhận đơn.'); },
  async cancelOrder(id: string) { return message((await apiClient.post(`/admin/vip-orders/${id}/cancel`)).data, 'Đã hủy đơn.'); },
  async reports() { return array<AdminReport>((await apiClient.get<AdminReport[]>('/admin/reports')).data); },
  async resolveReport(id: string, status: 'Resolved' | 'Ignored') {
    return (await apiClient.put(`/admin/reports/${id}/resolve`, { status })).data;
  },
  async feedback() { return array<AdminFeedback>((await apiClient.get<AdminFeedback[]>('/admin/feedback')).data); },
  async updateFeedback(id: string, status: 'REVIEWING' | 'RESOLVED' | 'REJECTED', adminReply: string) {
    return (await apiClient.put<{ message?: string; feedback: AdminFeedback }>(`/admin/feedback/${id}`, { status, adminReply })).data;
  },
  async sourceHealth() {
    const data = (await apiClient.get<SourceHealthResponse>('/admin/source-health')).data;
    return { sources: array<SourceHealth>(data.sources), totals: data.totals || {} };
  },
  async checkSources(id?: string) {
    return (await apiClient.post(`/admin/source-health/${id ? `${id}/check` : 'check'}`)).data;
  },
};
