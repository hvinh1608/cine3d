import { config } from '@/core/config';
import { cacheRepository, type SQLiteCacheRepository } from '@/data/cache/sqlite-cache';
import { apiClient } from '@/data/http/api-client';
import type { MetaItem, PaginatedMovies, WatchHistory } from '@/domain/models';
import {
  serializeMovieQuery,
  type DiscoveryRepository,
  type MovieQuery,
  type PersonDetail,
  type PersonKind,
  type Recommendations,
  type ScheduleEntry,
} from '@/features/discovery/domain/discovery-repository';

const key = (path: string) => `query:discovery:${path}:v1`;

export class HttpDiscoveryRepository implements DiscoveryRepository {
  constructor(private readonly cache: SQLiteCacheRepository = cacheRepository) {}

  private async cached<T>(path: string, forceNetwork = false): Promise<T> {
    const cacheKey = key(path);
    if (!forceNetwork) {
      const fresh = await this.cache.getFresh<T>(cacheKey);
      if (fresh) return fresh.value;
    }
    try {
      const { data } = await apiClient.get<T>(path);
      await this.cache.set(cacheKey, data, config.queryStaleTimeMs);
      return data;
    } catch (error) {
      const stale = await this.cache.get<T>(cacheKey);
      if (stale) return stale.value;
      throw error;
    }
  }

  getMovies(query: MovieQuery, options: { forceNetwork?: boolean; signal?: AbortSignal } = {}) {
    const queryString = serializeMovieQuery(query);
    const path = `/movies?${queryString}`;
    return this.getMoviePage(path, options.forceNetwork, options.signal);
  }

  private async getMoviePage(path: string, forceNetwork = false, signal?: AbortSignal): Promise<PaginatedMovies> {
    const cacheKey = key(path);
    if (!forceNetwork) {
      const fresh = await this.cache.getFresh<PaginatedMovies>(cacheKey);
      if (fresh) return fresh.value;
    }
    try {
      const { data } = await apiClient.get<PaginatedMovies>(path, { signal });
      await this.cache.set(cacheKey, data, config.queryStaleTimeMs);
      return data;
    } catch (error) {
      const stale = await this.cache.get<PaginatedMovies>(cacheKey);
      if (stale) return { ...stale.value, stale: true };
      throw error;
    }
  }

  getGenres(options: { forceNetwork?: boolean } = {}) {
    return this.cached<MetaItem[]>('/genres', options.forceNetwork);
  }

  getCountries(options: { forceNetwork?: boolean } = {}) {
    return this.cached<MetaItem[]>('/countries', options.forceNetwork);
  }

  getSchedule(options: { forceNetwork?: boolean } = {}) {
    return this.cached<ScheduleEntry[]>('/schedule', options.forceNetwork);
  }

  getPerson(kind: PersonKind, slug: string, options: { forceNetwork?: boolean } = {}) {
    return this.cached<PersonDetail>(`/${kind === 'actor' ? 'actors' : 'directors'}/${encodeURIComponent(slug)}`, options.forceNetwork);
  }

  async getPersonFollow(kind: PersonKind, id: string) {
    const { data } = await apiClient.get<{ following: boolean }>(`/people/${kind}/${id}/follow`);
    return data.following;
  }

  async togglePersonFollow(kind: PersonKind, id: string) {
    const { data } = await apiClient.post<{ following: boolean }>(`/people/${kind}/${id}/follow`);
    return data.following;
  }

  async getRecommendations() {
    const { data } = await apiClient.get<Recommendations>('/movies/recommendations/me');
    return data;
  }

  async getHistory() {
    const { data } = await apiClient.get<WatchHistory[]>('/user/history');
    return data;
  }
}

export const discoveryRepository = new HttpDiscoveryRepository();
