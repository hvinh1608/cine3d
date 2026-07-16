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
      { src: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' },
      { src: '/icon.png', sizes: '96x96', type: 'image/png' },
      { src: '/cine3d-favicon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/cine3d-favicon.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
