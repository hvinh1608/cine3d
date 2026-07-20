import type { Comment, HomeFeed, Movie, Playlist, WatchHistory } from '@/domain/models';

export type CommentSort = 'newest' | 'popular';
export interface CommentInput {
  content: string;
  parentId?: string;
  isSpoiler?: boolean;
  timestampSeconds?: number;
}
export interface PlaylistInput {
  name: string;
  description?: string;
  isPublic: boolean;
}

export interface MovieRepository {
  getHomeFeed(options?: { forceNetwork?: boolean }): Promise<HomeFeed>;
  getMovie(slug: string): Promise<Movie>;
  getRelated(movie: Movie): Promise<Movie[]>;
  incrementView(movieId: string): Promise<void>;
  getFavorites(): Promise<Movie[]>;
  toggleFavorite(movieId: string): Promise<{ favorited: boolean }>;
  getWatchlist(): Promise<Movie[]>;
  toggleWatchlist(movieId: string): Promise<{ inWatchlist: boolean }>;
  getHistory(): Promise<WatchHistory[]>;
  deleteHistory(id: string): Promise<void>;
  deleteHistoryBulk(ids?: string[]): Promise<void>;
  getFollowStatus(movieId: string): Promise<boolean>;
  toggleFollow(movieId: string): Promise<{ following: boolean }>;
  getPlaylists(): Promise<Playlist[]>;
  getPlaylist(id: string): Promise<Playlist>;
  createPlaylist(input: PlaylistInput): Promise<Playlist>;
  updatePlaylist(id: string, input: Partial<PlaylistInput>): Promise<Playlist>;
  deletePlaylist(id: string): Promise<void>;
  addPlaylistMovie(playlistId: string, movieId: string): Promise<void>;
  removePlaylistMovie(playlistId: string, movieId: string): Promise<void>;
  getRating(movieId: string): Promise<number | null>;
  rateMovie(movieId: string, score: number): Promise<number>;
  getComments(movieId: string, sort: CommentSort): Promise<Comment[]>;
  createComment(movieId: string, input: CommentInput): Promise<Comment>;
  toggleCommentLike(commentId: string): Promise<boolean>;
  deleteComment(commentId: string): Promise<void>;
  togglePinComment(commentId: string): Promise<boolean>;
  report(input: { movieId?: string; commentId?: string; type: string; content: string }): Promise<void>;
}

export const movieKeys = {
  all: ['movies'] as const,
  home: () => [...movieKeys.all, 'home'] as const,
  detail: (slug: string) => [...movieKeys.all, 'detail', slug] as const,
  favorites: () => [...movieKeys.all, 'favorites'] as const,
  watchlist: () => [...movieKeys.all, 'watchlist'] as const,
  history: () => [...movieKeys.all, 'history'] as const,
  follow: (movieId: string) => [...movieKeys.all, 'follow', movieId] as const,
  rating: (movieId: string) => [...movieKeys.all, 'rating', movieId] as const,
  comments: (movieId: string, sort: CommentSort) => [...movieKeys.all, 'comments', movieId, sort] as const,
  playlists: () => [...movieKeys.all, 'playlists'] as const,
  playlist: (id: string) => [...movieKeys.all, 'playlist', id] as const,
};
