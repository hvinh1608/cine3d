import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CINE3D',
    short_name: 'CINE3D',
    description: 'Khám phá và xem phim trực tuyến chất lượng cao.',
    start_url: '/',
    display: 'standalone',
    scope: '/',
    orientation: 'any',
    background_color: '#020205',
    theme_color: '#dc2626',
    icons: [
      { src: '/cine3d-favicon.png', sizes: '512x512', type: 'image/png' },
      { src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' },
    ],
  };
}
