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

export interface ViewerProfile {
  id: string;
  name: string;
  avatar?: string | null;
  isKids: boolean;
  hasPin: boolean;
  createdAt: string;
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
  hasHydrated: boolean;
  authReady: boolean;
  favorites: Movie[];
  favoriteIds: string[];
  watchlist: Movie[];
  watchHistory: WatchHistoryItem[];
  profiles: ViewerProfile[];
  selectedProfileId: string | null;
  reduceMotion: boolean;
  toast: { id: number; message: string; tone: 'info' | 'success' | 'error' } | null;
  
  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  setSession: (user: User, accessToken: string) => void;
  setHasHydrated: (hydrated: boolean) => void;
  setAuthReady: (ready: boolean) => void;
  setFavorites: (favorites: Movie[]) => void;
  setWatchlist: (watchlist: Movie[]) => void;
  setWatchHistory: (history: WatchHistoryItem[]) => void;
  setProfiles: (profiles: ViewerProfile[]) => void;
  selectProfile: (profileId: string | null) => void;
  setReduceMotion: (reduce: boolean) => void;
  showToast: (message: string, tone?: 'info' | 'success' | 'error') => void;
  clearToast: () => void;
  
  logout: () => void;
}

export const useStore = create<AppState>()(persist((set, get) => ({
  user: null,
  accessToken: null,
  hasHydrated: false,
  authReady: false,
  favorites: [],
  favoriteIds: [],
  watchlist: [],
  watchHistory: [],
  profiles: [],
  selectedProfileId: null,
  reduceMotion: false,
  toast: null,

  setUser: (user) => set({ user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setSession: (user, accessToken) => set({ user, accessToken }),
  setHasHydrated: (hasHydrated) => set({ hasHydrated }),
  setAuthReady: (authReady) => set({ authReady }),
  setFavorites: (favorites) => set({
    favorites,
    favoriteIds: favorites.map((entry) => entry.id),
  }),
  setWatchlist: (watchlist) => set({ watchlist }),
  setWatchHistory: (watchHistory) => set({ watchHistory }),
  setProfiles: (profiles) => set((state) => ({
    profiles,
    selectedProfileId: state.selectedProfileId
      && !profiles.some((profile) => profile.id === state.selectedProfileId)
      ? (profiles[0]?.id || null)
      : state.selectedProfileId,
  })),
  selectProfile: (selectedProfileId) => set({
    selectedProfileId,
    favorites: [],
    favoriteIds: [],
    watchlist: [],
    watchHistory: [],
  }),
  setReduceMotion: (reduceMotion) => set({ reduceMotion }),
  showToast: (message, tone = 'info') => set({ toast: { id: Date.now(), message, tone } }),
  clearToast: () => set({ toast: null }),

  logout: () => {
    const accessToken = get().accessToken;
    set({
      user: null,
      accessToken: null,
      authReady: true,
      favorites: [],
      favoriteIds: [],
      watchlist: [],
      watchHistory: [],
      profiles: [],
      selectedProfileId: null,
    });

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.ready.then(async (registration) => {
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) return;
        if (accessToken) {
          await fetch(`${apiUrl}/push/subscribe`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          }).catch(() => undefined);
        }
        await subscription.unsubscribe().catch(() => false);
      }).catch(() => undefined);
    }
    void fetch(`${apiUrl}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }).catch(() => undefined);
  },
}), {
  name: 'cine3d-auth',
  partialize: (state) => ({
    user: state.user,
    reduceMotion: state.reduceMotion,
    selectedProfileId: state.selectedProfileId,
    // Persist IDs only as a fast UI hint; AuthBootstrap reloads the truth from API.
    favoriteIds: state.favoriteIds,
  }),
  onRehydrateStorage: () => (state, error) => {
    if (error) {
      console.warn('Failed to restore auth state from storage.', error);
    }
    if (!state?.user) {
      useStore.setState({ favorites: [], favoriteIds: [] });
    }
    // Always mark hydration complete, even when storage is empty or corrupt.
    useStore.setState({
      hasHydrated: true,
      ...(!state?.user ? { authReady: true } : {}),
    });
  },
}));
