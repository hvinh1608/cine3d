import { config } from '@/core/config';
import { cacheRepository, type SQLiteCacheRepository } from '@/data/cache/sqlite-cache';
import { apiClient } from '@/data/http/api-client';
import type { Comment, HomeFeed, Movie, Playlist, WatchHistory } from '@/domain/models';
import type { CommentInput, CommentSort, MovieRepository, PlaylistInput } from '@/features/movies/domain/movie-repository';

const HOME_CACHE_KEY = 'query:movies:home:v1';

export class HttpMovieRepository implements MovieRepository {
  constructor(private readonly cache: SQLiteCacheRepository = cacheRepository) {}

  async getHomeFeed({ forceNetwork = false } = {}): Promise<HomeFeed> {
    if (!forceNetwork) {
      const cached = await this.cache.getFresh<HomeFeed>(HOME_CACHE_KEY);
      if (cached) return cached.value;
    }

    try {
      const { data } = await apiClient.get<HomeFeed>('/movies/home');
      await this.cache.set(HOME_CACHE_KEY, data, config.queryStaleTimeMs);
      return data;
    } catch (error) {
      const fallback = await this.cache.get<HomeFeed>(HOME_CACHE_KEY);
      if (fallback) return { ...fallback.value, partial: true };
      throw error;
    }
  }

  async getMovie(slug: string) {
    return (await apiClient.get<Movie>(`/movies/${encodeURIComponent(slug)}`)).data;
  }
  async getRelated(movie: Movie) {
    const genre = movie.movieGenres?.[0]?.genre.slug;
    const { data } = await apiClient.get<{ movies: Movie[] }>('/movies', {
      params: { genre, type: movie.isSeries ? 'series' : 'movie', limit: 12 },
    });
    return data.movies.filter((item) => item.slug !== movie.slug).slice(0, 10);
  }

  async incrementView(movieId: string) {
    await apiClient.post(`/movies/${encodeURIComponent(movieId)}/view`);
  }

  async getFavorites() { return (await apiClient.get<Movie[]>('/user/favorites')).data; }
  async toggleFavorite(movieId: string) {
    return (await apiClient.post<{ favorited: boolean }>(`/user/favorites/${encodeURIComponent(movieId)}`)).data;
  }
  async getWatchlist() { return (await apiClient.get<Movie[]>('/user/watchlist')).data; }
  async toggleWatchlist(movieId: string) {
    return (await apiClient.post<{ inWatchlist: boolean }>(`/user/watchlist/${encodeURIComponent(movieId)}`)).data;
  }
  async getHistory() { return (await apiClient.get<WatchHistory[]>('/user/history')).data; }
  async deleteHistory(id: string) { await apiClient.delete(`/user/history/${encodeURIComponent(id)}`); }
  async deleteHistoryBulk(ids?: string[]) {
    await apiClient.post('/user/history/bulk-delete', ids ? { ids } : { all: true });
  }
  async getFollowStatus(movieId: string) {
    return (await apiClient.get<{ following: boolean }>(`/user/follows/${encodeURIComponent(movieId)}`)).data.following;
  }
  async toggleFollow(movieId: string) {
    return (await apiClient.post<{ following: boolean }>(`/user/follows/${encodeURIComponent(movieId)}`)).data;
  }
  async getPlaylists() { return (await apiClient.get<Playlist[]>('/user/playlists')).data; }
  async getPlaylist(id: string) { return (await apiClient.get<Playlist>(`/playlists/${encodeURIComponent(id)}`)).data; }
  async createPlaylist(input: PlaylistInput) {
    return (await apiClient.post<Playlist>('/user/playlists', input)).data;
  }
  async updatePlaylist(id: string, input: Partial<PlaylistInput>) {
    return (await apiClient.put<Playlist>(`/user/playlists/${encodeURIComponent(id)}`, input)).data;
  }
  async deletePlaylist(id: string) { await apiClient.delete(`/user/playlists/${encodeURIComponent(id)}`); }
  async addPlaylistMovie(playlistId: string, movieId: string) {
    await apiClient.post(`/user/playlists/${encodeURIComponent(playlistId)}/movies/${encodeURIComponent(movieId)}`);
  }
  async removePlaylistMovie(playlistId: string, movieId: string) {
    await apiClient.delete(`/user/playlists/${encodeURIComponent(playlistId)}/movies/${encodeURIComponent(movieId)}`);
  }
  async getRating(movieId: string) {
    return (await apiClient.get<{ score: number | null }>(`/movies/${encodeURIComponent(movieId)}/ratings/me`)).data.score;
  }
  async rateMovie(movieId: string, score: number) {
    return (await apiClient.post<{ ratingAvg: number }>(`/movies/${encodeURIComponent(movieId)}/ratings`, { score })).data.ratingAvg;
  }
  async getComments(movieId: string, sort: CommentSort) {
    return (await apiClient.get<Comment[]>(`/movies/${encodeURIComponent(movieId)}/comments`, { params: { sort } })).data;
  }
  async createComment(movieId: string, input: CommentInput) {
    return (await apiClient.post<Comment>(`/movies/${encodeURIComponent(movieId)}/comments`, input)).data;
  }
  async toggleCommentLike(commentId: string) {
    return (await apiClient.post<{ liked: boolean }>(`/comments/${encodeURIComponent(commentId)}/like`)).data.liked;
  }
  async deleteComment(commentId: string) { await apiClient.delete(`/comments/${encodeURIComponent(commentId)}`); }
  async togglePinComment(commentId: string) {
    return (await apiClient.put<{ isPinned: boolean }>(`/comments/${encodeURIComponent(commentId)}/pin`)).data.isPinned;
  }
  async report(input: { movieId?: string; commentId?: string; type: string; content: string }) {
    await apiClient.post('/reports', input);
  }
}

export const movieRepository = new HttpMovieRepository();
