import type { Metadata } from 'next';
import '@fontsource-variable/outfit';
import './globals.css';
import { Suspense } from 'react';
import Navbar from '../components/ui/Navbar';
import Footer from '../components/ui/Footer';
import AdsterraNativeBanner from '../components/ads/AdsterraNativeBanner';
import CinemaBackground from '../components/canvas/DynamicCinemaBackground';
import AuthBootstrap from '../components/auth/AuthBootstrap';
import ToastViewport from '../components/ui/ToastViewport';
import BackToTop from '../components/ui/BackToTop';
import TranslationVoteBanner from '../components/ui/TranslationVoteBanner';
import PwaBootstrap from '../components/pwa/PwaBootstrap';
import CinemaSplash from '../components/ui/CinemaSplash';
import NavigationLoader from '../components/ui/NavigationLoader';
import MovieAssistant from '../components/assistant/MovieAssistant';
import ScrollReveal from '../components/ui/ScrollReveal';
import PageTransition from '../components/ui/PageTransition';
import ViewerLanguageBridge from '../components/ui/ViewerLanguageBridge';
import { getSiteUrl } from '../lib/site';

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'CINE3D - Trải Nghiệm Rạp Phim 3D Điện Ảnh Tại Nhà',
  description:
    'Website xem phim trực tuyến với giao diện điện ảnh 3D, chất lượng cao và trải nghiệm mượt trên web lẫn điện thoại.',
  keywords: 'cine3d, xem phim, xem phim online, phim full hd, phim thuyết minh, three.js cinema',
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
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://phimimg.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://img.phimapi.com" />
        <link rel="dns-prefetch" href="https://phimimg.com" />
        <link rel="dns-prefetch" href="https://pl31563507.profitableratecpmnetwork.com" />
      </head>
      <body className="relative flex min-h-full flex-col bg-[#191a22] text-slate-100">
        <AuthBootstrap />
        <PwaBootstrap />
        <ToastViewport />
        <BackToTop />
        <TranslationVoteBanner />
        <MovieAssistant />
        <ScrollReveal />
        <ViewerLanguageBridge />
        <CinemaBackground />
        <Suspense fallback={null}>
          <CinemaSplash />
        </Suspense>
        <Suspense fallback={null}>
          <NavigationLoader />
        </Suspense>

        <Suspense fallback={<div className="fixed top-0 left-0 w-full h-16 bg-black/80" />}>
          <Navbar />
        </Suspense>

        <main className="flex-1 w-full relative z-10 pt-20 pb-20 md:pb-0 flex flex-col">
          <PageTransition>{children}</PageTransition>
        </main>

        <AdsterraNativeBanner variant="fallback" />
        <Footer />
      </body>
    </html>
  );
}
