import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';
import { Suspense } from 'react';
import Navbar from '../components/ui/Navbar';
import Footer from '../components/ui/Footer';
import CinemaBackground from '../components/canvas/DynamicCinemaBackground';
import AuthBootstrap from '../components/auth/AuthBootstrap';
import ToastViewport from '../components/ui/ToastViewport';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700', '900'],
  variable: '--font-outfit',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'CINE3D - Trải Nghiệm Rạp Phim 3D Điện Ảnh Tại Nhà',
  description:
    'Website xem phim cao cấp với giao diện 3D không gian chiều sâu, hỗ trợ phim HLS/MP4, tốc độ tải tối ưu và giao diện điện ảnh sống động.',
  keywords: 'cine3d, xem phim, xem phim online, phim full hd, phim thuyet minh, three.js cinema',
  openGraph: {
    title: 'CINE3D - Trạp Phim Điện Ảnh 3D',
    description: 'Trải nghiệm giao diện điện ảnh 3D không gian chiều sâu độc đáo và cao cấp.',
    type: 'website',
  },
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${outfit.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#020205] text-slate-100 relative">
        <AuthBootstrap />
        <ToastViewport />
        {/* Cinematic 3D Canvas Background */}
        <CinemaBackground />

        {/* Global Navigation Header */}
        <Suspense fallback={<div className="fixed top-0 left-0 w-full h-16 bg-black/80" />}>
          <Navbar />
        </Suspense>

        {/* Dynamic Main App Section */}
        <main className="flex-1 w-full relative z-10 pt-20 flex flex-col">
          {children}
        </main>

        {/* Global Footer */}
        <Footer />
      </body>
    </html>
  );
}
