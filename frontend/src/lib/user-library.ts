import api from './api';
import { useStore } from '../hooks/useStore';
import type { Movie } from '../types/movie';

export async function loadFavorites(): Promise<void> {
  const { user, setFavorites } = useStore.getState();
  if (!user) {
    setFavorites([]);
    return;
  }

  try {
    const { data } = await api.get<Movie[]>('/user/favorites');
    setFavorites(data);
  } catch {
    // Keep the current in-memory list when offline.
  }
}

export async function toggleFavorite(movieId: string, movie?: Movie): Promise<void> {
  const store = useStore.getState();
  if (!store.user) {
    store.showToast('Vui lòng đăng nhập để lưu phim yêu thích!', 'info');
    return;
  }

  try {
    const { data } = await api.post<{ favorited: boolean }>(`/user/favorites/${movieId}`);
    useStore.setState((state) => {
      const current = state.favorites;
      let nextFavorites = current;
      let nextFavoriteIds = state.favoriteIds;

      if (data.favorited) {
        if (!current.some((entry) => entry.id === movieId)) {
          nextFavorites = movie ? [...current, movie] : current;
        }
        if (!nextFavoriteIds.includes(movieId)) {
          nextFavoriteIds = [...nextFavoriteIds, movieId];
        }
      } else {
        nextFavorites = current.filter((entry) => entry.id !== movieId);
        nextFavoriteIds = nextFavoriteIds.filter((id) => id !== movieId);
      }

      return { favorites: nextFavorites, favoriteIds: nextFavoriteIds };
    });

    if (data.favorited && !movie) {
      await loadFavorites();
    }

    store.showToast(
      data.favorited ? 'Đã thêm phim vào yêu thích.' : 'Đã xóa phim khỏi yêu thích.',
      'success',
    );
  } catch {
    store.showToast('Không thể cập nhật danh sách yêu thích.', 'error');
  }
}

export function isFavorite(movieId: string): boolean {
  return useStore.getState().favorites.some((entry) => entry.id === movieId);
}
