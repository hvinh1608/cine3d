'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { useStore } from '../../hooks/useStore';

const CinemaBackground = dynamic(() => import('./CinemaBackground'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 -z-10 bg-black" />,
});

export default function DynamicCinemaBackground() {
  const pathname = usePathname();
  const reduceMotion = useStore((state) => state.reduceMotion);
  const canRender3D = useSyncExternalStore(
    (onChange) => {
      const desktop = window.matchMedia('(min-width: 1024px)');
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      desktop.addEventListener('change', onChange);
      reduced.addEventListener('change', onChange);
      return () => {
        desktop.removeEventListener('change', onChange);
        reduced.removeEventListener('change', onChange);
      };
    },
    () => window.matchMedia('(min-width: 1024px)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
  const pageVisible = useSyncExternalStore(
    (onChange) => {
      document.addEventListener('visibilitychange', onChange);
      return () => document.removeEventListener('visibilitychange', onChange);
    },
    () => document.visibilityState === 'visible',
    () => false,
  );
  const staticBackgroundRoute = ['/account', '/admin', '/vip', '/watch', '/watch-together'].some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (reduceMotion || !canRender3D || !pageVisible || staticBackgroundRoute) {
    return <div className="fixed inset-0 -z-10 bg-gradient-to-tr from-black via-slate-950 to-neutral-900" />;
  }
  return <CinemaBackground />;
}
