'use client';

import { useEffect } from 'react';
import api from '../../lib/api';
import { useStore } from '../../hooks/useStore';

/** Validate a persisted session and restore the latest profile on app startup. */
export default function AuthBootstrap() {
  const hasHydrated = useStore((state) => state.hasHydrated);
  const authReady = useStore((state) => state.authReady);
  const user = useStore((state) => state.user);
  const setSession = useStore((state) => state.setSession);
  const setAuthReady = useStore((state) => state.setAuthReady);
  const logout = useStore((state) => state.logout);
  const setProfiles = useStore((state) => state.setProfiles);

  useEffect(() => {
    if (!hasHydrated || authReady) return;
    if (!user) {
      setAuthReady(true);
      return;
    }

    let active = true;
    // Access tokens intentionally live only in memory. Restore one directly
    // from the HttpOnly refresh cookie before private components can fetch.
    api.post('/auth/refresh')
      .then(({ data }) => {
        if (active) {
          setSession(data.user, data.accessToken);
          api.get('/user/profiles').then((response) => {
            if (active) setProfiles(response.data);
          }).catch(() => undefined);
        }
      })
      .catch(() => {
        if (active) logout();
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });

    return () => {
      active = false;
    };
  }, [authReady, hasHydrated, logout, setAuthReady, setProfiles, setSession, user]);

  return null;
}
