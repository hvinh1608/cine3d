import type { MetaItem, Movie, PaginatedMovies, Person, WatchHistory } from '@/domain/models';

export const movieSortValues = ['updatedAt', 'views', 'ratingAvg'] as const;
export const movieTypeValues = ['movie', 'series', 'anime', 'tv'] as const;

export type MovieSort = (typeof movieSortValues)[number];
export type MovieType = (typeof movieTypeValues)[number];

export interface MovieQuery {
  page: number;
  limit: number;
  search?: string;
  genre?: string;
  country?: string;
  year?: number;
  type?: MovieType;
  sortBy?: MovieSort;
}

export type PersonKind = 'actor' | 'director';

export interface PersonDetail extends Person {
  id: string;
  biography?: string | null;
  movies: Movie[];
}

export interface ScheduleEntry {
  id: string;
  title: string;
  episodeOrder: number;
  seasonNumber?: number | null;
  airDate: string;
  isReleased: boolean;
  movie: Pick<Movie, 'id' | 'slug' | 'title' | 'posterUrl' | 'status'>;
}

export interface Recommendations {
  movies: Movie[];
  personalized: boolean;
}

export interface DiscoveryRepository {
  getMovies(query: MovieQuery, options?: { forceNetwork?: boolean; signal?: AbortSignal }): Promise<PaginatedMovies>;
  getGenres(options?: { forceNetwork?: boolean }): Promise<MetaItem[]>;
  getCountries(options?: { forceNetwork?: boolean }): Promise<MetaItem[]>;
  getSchedule(options?: { forceNetwork?: boolean }): Promise<ScheduleEntry[]>;
  getPerson(kind: PersonKind, slug: string, options?: { forceNetwork?: boolean }): Promise<PersonDetail>;
  getPersonFollow(kind: PersonKind, id: string): Promise<boolean>;
  togglePersonFollow(kind: PersonKind, id: string): Promise<boolean>;
  getRecommendations(): Promise<Recommendations>;
  getHistory(): Promise<WatchHistory[]>;
}

export const discoveryKeys = {
  all: ['discovery'] as const,
  movies: (query: MovieQuery) => [...discoveryKeys.all, 'movies', query] as const,
  metadata: (kind: 'genres' | 'countries') => [...discoveryKeys.all, kind] as const,
  schedule: () => [...discoveryKeys.all, 'schedule'] as const,
  person: (kind: PersonKind, slug: string) => [...discoveryKeys.all, 'person', kind, slug] as const,
  personFollow: (kind: PersonKind, id: string) => [...discoveryKeys.all, 'person-follow', kind, id] as const,
  recommendations: () => [...discoveryKeys.all, 'recommendations'] as const,
  history: () => [...discoveryKeys.all, 'history'] as const,
};

export function serializeMovieQuery(query: MovieQuery): string {
  const params = new URLSearchParams();
  params.set('page', String(Math.max(1, Math.trunc(query.page))));
  params.set('limit', String(Math.min(64, Math.max(1, Math.trunc(query.limit)))));
  const search = query.search?.trim();
  if (search) params.set('search', search);
  if (query.genre) params.set('genre', query.genre);
  if (query.country) params.set('country', query.country);
  if (query.year && query.year >= 1900 && query.year <= 2100) params.set('year', String(Math.trunc(query.year)));
  if (query.type && movieTypeValues.includes(query.type)) params.set('type', query.type);
  if (query.sortBy && movieSortValues.includes(query.sortBy)) params.set('sortBy', query.sortBy);
  return params.toString();
}
