export type AdminSection = 'dashboard' | 'movies' | 'episodes' | 'users' | 'vip' | 'reports' | 'feedback' | 'sources' | 'metadata';
export type EntityStatus = 'all' | string;

export interface MetaEntity { id: string; name: string; slug: string }
export interface VideoSourceInput { id?: string; server: string; quality: string; url: string; type: 'hls' | 'mp4'; isPremium: boolean }
export interface SubtitleInput { id?: string; language: string; url: string }
export interface AdminEpisode {
  id: string; title: string; episodeOrder: number; seasonNumber?: number; airDate?: string | null;
  introEndSeconds?: number | null; outroStartSeconds?: number | null;
  videoSources: VideoSourceInput[]; subtitles: SubtitleInput[];
}
export interface AdminMovie {
  id: string; title: string; englishTitle?: string | null; slug: string; description: string;
  posterUrl: string; backdropUrl: string; trailerUrl?: string | null; releaseYear: number; duration: number;
  countryId: string; quality: string; isSeries: boolean; isDubbed?: boolean; status: string;
  isFeatured: boolean; isTrending: boolean; isProposed: boolean; isVip: boolean;
  vipEarlyAccessUntil?: string | null; episodeCount: number; episodes: AdminEpisode[];
  movieGenres: Array<{ genreId: string; genre?: MetaEntity }>;
}
export interface MoviePage { movies: AdminMovie[]; total: number; page: number; limit: number; totalPages: number }
export interface MovieInput {
  title: string; englishTitle: string; slug: string; description: string; posterUrl: string; backdropUrl: string;
  trailerUrl: string; releaseYear: number; duration: number; countryId: string; quality: string;
  isSeries: boolean; isDubbed: boolean; status: string; isFeatured: boolean; isTrending: boolean;
  isProposed: boolean; isVip: boolean; vipEarlyAccessUntil: string | null; genreIds: string[];
}
export interface EpisodeInput {
  movieId: string; title: string; episodeOrder: number; seasonNumber: number; airDate: string | null;
  introEndSeconds: number | null; outroStartSeconds: number | null;
  videoSources: VideoSourceInput[]; subtitles: SubtitleInput[];
}
export interface BulkEpisodeInput {
  seasonNumber: number; episodeOrder: number; title: string; url: string; airDate: string | null;
  server: string; quality: string; type: 'hls' | 'mp4'; isPremium: boolean;
}
export interface AdminUser {
  id: string; email: string; username: string; isLocked: boolean; isVip: boolean;
  vipExpiresAt?: string | null; role: { id?: string; name: 'USER' | 'ADMIN' };
}
export interface AdminReport {
  id: string; type: string; content: string; status: string; createdAt: string;
  user?: { username: string }; movie?: { title: string } | null;
}
export interface AdminVipOrder {
  id: string; orderCode: string; status: string; amount: number; durationDays: number; createdAt: string;
  paidAt?: string | null; user?: { username: string; email: string }; plan?: { name: string };
}
export interface AdminFeedback {
  id: string; category: string; subject: string; content: string; status: string; adminReply?: string | null;
  createdAt: string; user?: { username: string; email: string };
}
export interface AdminStats {
  totalUsers: number; totalMovies: number; totalEpisodes: number; totalViews: number; pendingReports: number;
  topMovies: Array<{ id: string; title: string; views: number; ratingAvg: number }>; recentReports: AdminReport[];
}
export interface AnalyticsEvent {
  id: string; name?: string; path?: string | null; movieId?: string | null; metadata?: unknown; createdAt: string;
}
export interface AnalyticsSummary {
  periodDays: number; activeUsers: number; events: Record<string, number>;
  recentPlayerErrors: AnalyticsEvent[]; recentQualityEvents: AnalyticsEvent[];
}
export interface SourceHealth {
  id: string; server: string; quality: string; url: string; healthStatus: string; lastCheckedAt?: string | null;
  lastStatusCode?: number | null; lastResponseTimeMs?: number | null; lastError?: string | null;
  consecutiveFailures: number; episode: { title: string; episodeOrder: number; movie: { title: string; slug: string } };
}
export interface SourceHealthResponse { sources: SourceHealth[]; totals: Record<string, number> }
