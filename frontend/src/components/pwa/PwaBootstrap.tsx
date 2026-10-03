'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import api from '../../lib/api';
import { readUtmFromSearch } from '../../lib/utm';

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
    const utm = readUtmFromSearch(window.location.search);
    const hasUtm = Object.keys(utm).length > 0;
    const timer = window.setTimeout(() => {
      void api.post('/analytics/events', {
        name: 'page_view',
        path: pathname,
        metadata: hasUtm ? utm : undefined,
      }).catch(() => undefined);
      if (
        hasUtm &&
        (utm.utm_medium === 'push' ||
          utm.utm_campaign?.startsWith('campaign_') ||
          utm.utm_campaign === 'new_movie' ||
          utm.utm_campaign === 'new_episode')
      ) {
        void api.post('/analytics/events', {
          name: 'campaign_open',
          path: pathname,
          metadata: utm,
        }).catch(() => undefined);
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
