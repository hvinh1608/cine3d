import type { NextConfig } from "next";

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/** Let Cloudflare edge keep a short copy of public HTML (home PC origin stays cold). */
const PUBLIC_HTML_CDN = [
  { key: 'CDN-Cache-Control', value: 'public, s-maxage=120, stale-while-revalidate=600' },
  { key: 'Cloudflare-CDN-Cache-Control', value: 'public, s-maxage=120, stale-while-revalidate=600' },
];

const STATIC_LONG_CACHE = [
  { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
  { key: 'CDN-Cache-Control', value: 'public, max-age=31536000, immutable' },
  { key: 'Cloudflare-CDN-Cache-Control', value: 'public, max-age=31536000, immutable' },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: STATIC_LONG_CACHE,
      },
      {
        source: '/:file(cine3d-.*\\.(?:png|webp|jpg)|icon\\.png|apple-icon\\.png|favicon\\.ico|invincible-atom-eve-poster\\.jpg|manifest\\.webmanifest)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' },
          { key: 'CDN-Cache-Control', value: 'public, max-age=604800' },
          { key: 'Cloudflare-CDN-Cache-Control', value: 'public, max-age=604800' },
        ],
      },
      // Public catalog pages — safe to edge-cache briefly (no private account HTML).
      { source: '/', headers: PUBLIC_HTML_CDN },
      { source: '/search', headers: PUBLIC_HTML_CDN },
      { source: '/schedule', headers: PUBLIC_HTML_CDN },
      { source: '/download', headers: PUBLIC_HTML_CDN },
      { source: '/vip', headers: PUBLIC_HTML_CDN },
      { source: '/movies/:path*', headers: PUBLIC_HTML_CDN },
      { source: '/the-loai/:path*', headers: PUBLIC_HTML_CDN },
      { source: '/quoc-gia/:path*', headers: PUBLIC_HTML_CDN },
      { source: '/nam/:path*', headers: PUBLIC_HTML_CDN },
      { source: '/actors/:path*', headers: PUBLIC_HTML_CDN },
      { source: '/directors/:path*', headers: PUBLIC_HTML_CDN },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        // Proxy phimimg.com images through the backend so Next.js image
        // optimization can convert them to WebP/AVIF and resize them.
        source: '/api/image-proxy',
        destination: `${API_URL}/image-proxy`,
      },
    ];
  },
  images: {
    // Use Cloudinary directly as the responsive image CDN. This bypasses
    // Vercel's exhausted /_next/image quota while retaining width-aware srcsets.
    loader: 'custom',
    loaderFile: './src/lib/cloudinary-loader.ts',
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '**.onrender.com' },
      { protocol: 'https', hostname: 'api.cine3d.id.vn' },
      { protocol: 'https', hostname: '**' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 640, 750, 828, 1080, 1200, 1440, 1920],
    imageSizes: [32, 48, 64, 80, 96, 128, 256, 384],
  },
};

export default nextConfig;
