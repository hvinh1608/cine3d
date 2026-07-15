import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  images: {
    // phimimg.com rejects requests coming from Vercel's image optimizer with 402.
    // Load the public CDN images directly in the browser instead.
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'phimimg.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'http', hostname: 'localhost', port: '5000' },
      { protocol: 'https', hostname: '**.onrender.com' },
      { protocol: 'https', hostname: 'api.cine3d.id.vn' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
