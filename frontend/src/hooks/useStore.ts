import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Episode, Movie } from '../types/movie';

interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  avatar?: string;
  isVip?: boolean;
  vipExpiresAt?: string | null;
}

interface WatchHistoryItem {
  id: string;
  movieId: string;
  episodeId: string | null;
  watchedTime: number;
  duration: number;
  updatedAt: string;
  movie: {
    id: string;
    title: string;
    slug: string;
    backdropUrl: string;
    posterUrl: string;
    episodes?: Episode[];
  };
}

interface AppState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  hasHydrated: boolean;
  authReady: boolean;
  favorites: Movie[];
  watchlist: Movie[];
  watchHistory: WatchHistoryItem[];
  reduceMotion: boolean;
  toast: { id: number; message: string; tone: 'info' | 'success' | 'error' } | null;
  
  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  setSession: (user: User, accessToken: string, refreshToken?: string) => void;
  setHasHydrated: (hydrated: boolean) => void;
  setAuthReady: (ready: boolean) => void;
  setFavorites: (favorites: Movie[]) => void;
  setWatchlist: (watchlist: Movie[]) => void;
  setWatchHistory: (history: WatchHistoryItem[]) => void;
  setReduceMotion: (reduce: boolean) => void;
  showToast: (message: string, tone?: 'info' | 'success' | 'error') => void;
  clearToast: () => void;
  
  logout: () => void;
}

export const useStore = create<AppState>()(persist((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  hasHydrated: false,
  authReady: false,
  favorites: [],
  watchlist: [],
  watchHistory: [],
  reduceMotion: false,
  toast: null,

  setUser: (user) => set({ user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setSession: (user, accessToken, refreshToken) => set({
    user,
    accessToken,
    refreshToken: refreshToken || null,
    authReady: true,
  }),
  setHasHydrated: (hasHydrated) => set({ hasHydrated }),
  setAuthReady: (authReady) => set({ authReady }),
  setFavorites: (favorites) => set({ favorites }),
  setWatchlist: (watchlist) => set({ watchlist }),
  setWatchHistory: (watchHistory) => set({ watchHistory }),
  setReduceMotion: (reduceMotion) => set({ reduceMotion }),
  showToast: (message, tone = 'info') => set({ toast: { id: Date.now(), message, tone } }),
  clearToast: () => set({ toast: null }),

  logout: () => {
    const refreshToken = get().refreshToken;
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      authReady: true,
      favorites: [],
      watchlist: [],
      watchHistory: [],
    });

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    void fetch(`${apiUrl}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    }).catch(() => undefined);
  },
}), {
  name: 'cine3d-auth',
  partialize: (state) => ({
    user: state.user,
    reduceMotion: state.reduceMotion,
  }),
  onRehydrateStorage: () => (state) => {
    state?.setHasHydrated(true);
    if (!state?.user) state?.setAuthReady(true);
  },
}));
