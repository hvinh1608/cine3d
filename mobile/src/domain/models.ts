export interface VideoSource {
  id: string;
  server: string;
  quality: string;
  url: string;
  type: 'hls' | 'mp4';
  isPremium?: boolean;
}

export interface Subtitle {
  id: string;
  language: string;
  url: string;
}

export interface Episode {
  id: string;
  title: string;
  episodeOrder: number;
  seasonNumber?: number;
  airDate?: string | null;
  videoSources: VideoSource[];
  subtitles?: Subtitle[];
  premiumSourcesLocked?: number;
  introEndSeconds?: number | null;
  outroStartSeconds?: number | null;
}

export interface Movie {
  id: string;
  title: string;
  englishTitle?: string | null;
  slug: string;
  description?: string;
  posterUrl: string;
  backdropUrl: string;
  trailerUrl?: string | null;
  releaseYear: number;
  duration?: number;
  quality: string;
  ratingAvg: number;
  views?: number;
  isSeries: boolean;
  isDubbed?: boolean;
  status?: string;
  episodeCount: number;
  episodes?: Episode[];
  isVip?: boolean;
  requiresVip?: boolean;
  vipEarlyAccessUntil?: string | null;
  isEarlyAccess?: boolean;
  movieGenres?: { genre: MetaItem }[];
  movieActors?: { actor: Person }[];
  movieDirectors?: { director: Person }[];
  country?: MetaItem | null;
}

export interface Banner {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  movie: Movie;
}

export interface MetaItem {
  name: string;
  slug: string;
}

export interface Person extends MetaItem {
  avatarUrl?: string | null;
}

export interface PaginatedMovies {
  movies: Movie[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stale?: boolean;
}

export interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string | null;
  role: string;
  isVip: boolean;
  vipExpiresAt?: string | null;
}

export interface Profile {
  id: string;
  name: string;
  avatar?: string | null;
  isKids: boolean;
  pinEnabled?: boolean;
  hasPin?: boolean;
}

export interface WatchHistory {
  id: string;
  movieId: string;
  episodeId?: string | null;
  progressSeconds: number;
  durationSeconds?: number;
  completed: boolean;
  updatedAt: string;
  movie?: Movie;
  watchedTime?: number;
  duration?: number;
}

export interface Comment {
  id: string;
  content: string;
  user: Pick<User, 'id' | 'username' | 'avatar' | 'isVip'>;
  movieId: string;
  parentId?: string | null;
  isSpoiler: boolean;
  isPinned: boolean;
  timestampSeconds?: number | null;
  likesCount: number;
  isLiked: boolean;
  createdAt: string;
  updatedAt?: string;
  replies?: Comment[];
}

export interface PlaylistItem {
  id: string;
  playlistId: string;
  movieId: string;
  position: number;
  createdAt: string;
  movie: Movie;
}

export interface Playlist {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  isPublic: boolean;
  items: PlaylistItem[];
  _count?: { items: number };
  user?: Pick<User, 'username' | 'avatar'>;
  createdAt: string;
  updatedAt: string;
}

export interface MovieInteractionState {
  favorited: boolean;
  inWatchlist: boolean;
  following: boolean;
  rating: number | null;
}

export interface VipSubscription {
  id: string;
  plan: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | string;
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | string;
  startsAt: string;
  expiresAt: string;
  autoRenew?: boolean;
}

export interface ApiErrorPayload {
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
  requestId?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface HomeFeed {
  banners: Banner[];
  trending: Movie[];
  proposed: Movie[];
  movies: Movie[];
  countries: {
    china: Movie[];
    korea: Movie[];
    vietnam: Movie[];
  };
  partial?: boolean;
}
