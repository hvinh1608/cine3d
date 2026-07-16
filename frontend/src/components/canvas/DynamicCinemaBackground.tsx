'use client';

import dynamic from 'next/dynamic';
import { useSyncExternalStore } from 'react';
import { useStore } from '../../hooks/useStore';

const CinemaBackground = dynamic(() => import('./CinemaBackground'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 -z-10 bg-black" />,
});

export default function DynamicCinemaBackground() {
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

  if (reduceMotion || !canRender3D) {
    return <div className="fixed inset-0 -z-10 bg-gradient-to-tr from-black via-slate-950 to-neutral-900" />;
  }
  return <CinemaBackground />;
}
