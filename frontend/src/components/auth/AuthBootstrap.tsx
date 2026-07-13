'use client';

import { useEffect } from 'react';
import api from '../../lib/api';
import { useStore } from '../../hooks/useStore';

/** Validate a persisted session and restore the latest profile on app startup. */
export default function AuthBootstrap() {
  const hasHydrated = useStore((state) => state.hasHydrated);
  const user = useStore((state) => state.user);
  const setUser = useStore((state) => state.setUser);

  useEffect(() => {
    if (!hasHydrated || !user) return;

    let active = true;
    api.get('/auth/me')
      .then(({ data }) => {
        if (active) setUser(data.user);
      })
      .catch(() => {
        // The API interceptor clears the session when refresh also fails.
      });

    return () => {
      active = false;
    };
  }, [hasHydrated, user?.id, setUser]);

  return null;
}
