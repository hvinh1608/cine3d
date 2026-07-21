import type { Metadata } from 'next';
import '@fontsource-variable/outfit';
import './globals.css';
import { Suspense } from 'react';
import Navbar from '../components/ui/Navbar';
import Footer from '../components/ui/Footer';
import CinemaBackground from '../components/canvas/DynamicCinemaBackground';
import AuthBootstrap from '../components/auth/AuthBootstrap';
import ToastViewport from '../components/ui/ToastViewport';
import BackToTop from '../components/ui/BackToTop';
import TranslationVoteBanner from '../components/ui/TranslationVoteBanner';
import CinemaSplash from '../components/ui/CinemaSplash';
import PwaBootstrap from '../components/pwa/PwaBootstrap';
import { getSiteUrl } from '../lib/site';

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'CINE3D - Trải Nghiệm Rạp Phim 3D Điện Ảnh Tại Nhà',
  description:
    'Website xem phim cao cấp với giao diện 3D có chiều sâu, hỗ trợ phim HLS/MP4, tốc độ tải tối ưu và trải nghiệm điện ảnh sống động.',
  keywords: 'cine3d, xem phim, xem phim online, phim full hd, phim thuyết minh, three.js cinema',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'CINE3D - Rạp Phim Điện Ảnh 3D',
    description: 'Trải nghiệm giao diện điện ảnh 3D có chiều sâu, độc đáo và cao cấp.',
    type: 'website',
    url: siteUrl,
    siteName: 'CINE3D',
    locale: 'vi_VN',
  },
  twitter: { card: 'summary_large_image', title: 'CINE3D', description: 'Khám phá và xem phim trực tuyến chất lượng cao.' },
  robots: { index: true, follow: true },
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://api.cine3d.id.vn" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://phimimg.com" />
      </head>
      <body className="relative flex min-h-full flex-col bg-[#191a22] text-slate-100">
        <CinemaSplash />
        <AuthBootstrap />
        <PwaBootstrap />
        <ToastViewport />
        <BackToTop />
        <TranslationVoteBanner />
        <CinemaBackground />

        <Suspense fallback={<div className="fixed top-0 left-0 w-full h-16 bg-black/80" />}>
          <Navbar />
        </Suspense>

        <main className="flex-1 w-full relative z-10 pt-20 pb-20 md:pb-0 flex flex-col">
          {children}
        </main>

        <Footer />
      </body>
    </html>
  );
}
