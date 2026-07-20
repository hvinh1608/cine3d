import { apiClient } from '@/data/http/api-client';

export type PlayerEventName =
  | 'movie_play'
  | 'movie_complete'
  | 'player_error'
  | 'player_startup'
  | 'player_buffer'
  | 'server_fallback';

export interface ResolvedEntitlement {
  id: string;
  episodeId: string;
  expiresAt: string;
  source: {
    id: string;
    url: string;
    type: string;
    quality: string;
    server: string;
  };
}

export const playerApi = {
  async saveProgress(movieId: string, episodeId: string, watchedTime: number, duration: number) {
    await apiClient.post('/user/history', { movieId, episodeId, watchedTime, duration });
  },

  async track(name: PlayerEventName, movieId: string, metadata: Record<string, unknown> = {}) {
    await apiClient.post('/analytics/events', { name, movieId, path: `/watch/${movieId}`, metadata });
  },

  async resolveDownload(episodeId: string, sourceId: string): Promise<ResolvedEntitlement> {
    const created = await apiClient.post<{ entitlement: { token: string } }>('/downloads/entitlements', {
      episodeId,
      sourceId,
    });
    const resolved = await apiClient.get<{ entitlement: ResolvedEntitlement }>(
      `/downloads/entitlements/${encodeURIComponent(created.data.entitlement.token)}`,
    );
    return resolved.data.entitlement;
  },

  async reportPlayback(movieId: string, episodeId: string, sourceId: string, content: string) {
    await apiClient.post('/reports', {
      movieId,
      type: 'playback',
      content: `${content.trim().slice(0, 1800)}\nEpisode: ${episodeId}; Source: ${sourceId}`,
    });
  },
};
