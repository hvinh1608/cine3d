'use client';

import { useEffect, useRef } from 'react';
import api, { isAuthFailure, refreshSession } from '../../lib/api';
import { useStore } from '../../hooks/useStore';
import { loadFavorites } from '../../lib/user-library';

/** Validate a persisted session and restore profile-scoped library data on app startup. */
export default function AuthBootstrap() {
  const hasHydrated = useStore((state) => state.hasHydrated);
  const authReady = useStore((state) => state.authReady);
  const user = useStore((state) => state.user);
  const setAuthReady = useStore((state) => state.setAuthReady);
  const logout = useStore((state) => state.logout);
  const setProfiles = useStore((state) => state.setProfiles);
  const selectedProfileId = useStore((state) => state.selectedProfileId);
  const skipProfileFavoriteReload = useRef(true);
  const bootstrapStarted = useRef(false);

  useEffect(() => {
    if (!hasHydrated || authReady) return;
    if (!user) {
      setAuthReady(true);
      return;
    }
    if (bootstrapStarted.current) return;
    bootstrapStarted.current = true;

    let active = true;
    void (async () => {
      try {
        await refreshSession();
        if (!active) return;
        try {
          const response = await api.get('/user/profiles');
          if (active) setProfiles(response.data);
        } catch {
          // Profile list is optional for account-level favorites.
        }
        if (active) await loadFavorites();
      } catch (error) {
        if (active && isAuthFailure(error)) logout();
      } finally {
        if (active) setAuthReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [authReady, hasHydrated, logout, setAuthReady, setProfiles, user]);

  useEffect(() => {
    if (!authReady || !user) return;
    if (skipProfileFavoriteReload.current) {
      skipProfileFavoriteReload.current = false;
      return;
    }
    void loadFavorites();
  }, [authReady, selectedProfileId, user]);

  return null;
}
