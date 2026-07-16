'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import api from '../../lib/api';

export default function PwaBootstrap() {
  const pathname = usePathname();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((registration) => registration.update())
        .catch((error) => {
          console.warn('Service worker registration failed.', error);
        });
    }
  }, []);

  useEffect(() => {
    if (!pathname) return;
    const timer = window.setTimeout(() => {
      void api.post('/analytics/events', { name: 'page_view', path: pathname }).catch(() => undefined);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
