'use client';

import dynamic from 'next/dynamic';

const CinemaBackground = dynamic(() => import('./CinemaBackground'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 -z-10 bg-black" />,
});

export default CinemaBackground;
