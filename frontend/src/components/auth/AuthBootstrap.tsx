'use client';

import { useEffect, useRef } from 'react';
import api, { isAuthFailure, logoutOnce, refreshSession } from '../../lib/api';
import { useStore } from '../../hooks/useStore';
import { loadFavorites } from '../../lib/user-library';

let bootstrapFlight: Promise<void> | null = null;

async function restoreSession(): Promise<void> {
  await refreshSession();
  try {
    const response = await api.get('/user/profiles');
    useStore.getState().setProfiles(response.data);
  } catch {
    // Profile list is optional for account-level favorites.
  }
  await loadFavorites();
}

/** Validate a persisted session and restore profile-scoped library data on app startup. */
export default function AuthBootstrap() {
  const hasHydrated = useStore((state) => state.hasHydrated);
  const authReady = useStore((state) => state.authReady);
  const user = useStore((state) => state.user);
  const setAuthReady = useStore((state) => state.setAuthReady);
  const selectedProfileId = useStore((state) => state.selectedProfileId);
  const skipProfileFavoriteReload = useRef(true);

  useEffect(() => {
    if (!hasHydrated || authReady) return;
    if (!user) {
      setAuthReady(true);
      return;
    }

    bootstrapFlight ??= (async () => {
      try {
        await restoreSession();
        const { accessToken, user: nextUser } = useStore.getState();
        // Persisted user without a restored token is not a usable session.
        if (nextUser && !accessToken) await logoutOnce();
      } catch (error) {
        // Auth failures clear the session; network blips keep the user shell
        // only when a later request can still refresh the cookie.
        if (isAuthFailure(error)) await logoutOnce();
        else if (!useStore.getState().accessToken) await logoutOnce();
      } finally {
        useStore.getState().setAuthReady(true);
        bootstrapFlight = null;
      }
    })();
  }, [authReady, hasHydrated, setAuthReady, user]);

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
