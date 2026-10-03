import type { Metadata } from 'next';
import HomeClient, { type HomeInitialData } from '../components/home/HomeClient';
import { getSiteUrl } from '../lib/site';
import { rewriteImageUrls } from '../lib/image-url';

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// Home refreshes periodically so catalog/synopsis stay fresh on self-hosted Docker.
export const revalidate = 120;

export const metadata: Metadata = {
  title: 'CINE3D - Xem phim trực tuyến chất lượng cao',
  description: 'CINE3D là không gian xem phim trực tuyến với phim Vietsub, thuyết minh, phim lẻ, phim bộ và trải nghiệm điện ảnh tối ưu trên web lẫn Android.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'CINE3D - Xem phim trực tuyến chất lượng cao',
    description: 'Khám phá phim mới, phim thịnh hành và xem phim trực tuyến trên CINE3D.',
    url: '/',
    type: 'website',
    siteName: 'CINE3D',
    images: [{ url: '/cine3d-welcome-banner.png', width: 1672, height: 941, alt: 'CINE3D - Không gian điện ảnh trực tuyến' }],
  },
};

function compactMovieRows(value: unknown, limit: number): HomeInitialData['movies'] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, limit).map((item) => {
    const movie = { ...item };
    delete movie.createdAt;
    delete movie.updatedAt;
    delete movie.countryId;
    delete movie.kkphimId;
    const rawDescription = typeof movie.description === 'string' ? movie.description.trim() : '';
    const titleLike = rawDescription
      && (rawDescription === movie.title || rawDescription === movie.englishTitle);
    return {
      ...movie,
      // Keep a short synopsis for home cards. Empty/title-only strings become ''
      // so the UI can fall back later; do not wipe real descriptions.
      description: titleLike ? '' : rawDescription.slice(0, 420),
      episodes: [],
      movieActors: [],
      movieDirectors: [],
    };
  }) as HomeInitialData['movies'];
}

async function loadHomeData(): Promise<HomeInitialData> {
  const [homeResult, animeResult] = await Promise.allSettled([
    fetch(`${API_URL}/movies/home`, { cache: 'force-cache' }).then(async (response) => {
      if (!response.ok) throw new Error(`Home API returned ${response.status}`);
      return response.json();
    }),
    fetch(`${API_URL}/movies?type=hoathinh&limit=12`, { cache: 'force-cache' }).then(async (response) => {
      if (!response.ok) throw new Error(`Anime API returned ${response.status}`);
      return response.json();
    }),
  ]);

  const home = homeResult.status === 'fulfilled' ? homeResult.value : {};
  const anime = animeResult.status === 'fulfilled' ? animeResult.value : {};
  const failedSections = [homeResult, animeResult].filter((result) => result.status === 'rejected').length;

  return {
    banners: Array.isArray(home.banners) ? home.banners : [],
    trending: compactMovieRows(home.trending, 12),
    proposed: compactMovieRows(home.proposed, 18),
    movies: compactMovieRows(home.movies, 16),
    anime: compactMovieRows(anime.movies, 12),
    china: compactMovieRows(home.countries?.china, 8),
    korea: compactMovieRows(home.countries?.korea, 8),
    vietnam: compactMovieRows(home.countries?.vietnam, 8),
    loadError: failedSections === 2
      ? 'Không tải được danh sách phim lúc này. Vui lòng thử lại sau giây lát.'
      : failedSections === 1
        ? 'Một phần nội dung đang tải chậm và tạm chưa hiển thị.'
        : '',
  };
}

export default async function HomePage() {
  const siteUrl = getSiteUrl();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        name: 'CINE3D',
        alternateName: ['Cine 3D', 'CINE3D Việt Nam'],
        url: `${siteUrl}/`,
        publisher: { '@id': `${siteUrl}/#organization` },
        inLanguage: 'vi-VN',
        description: 'Nền tảng xem phim trực tuyến CINE3D.',
      },
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: 'CINE3D',
        url: `${siteUrl}/`,
        logo: {
          '@type': 'ImageObject',
          url: `${siteUrl}/icon.png`,
        },
      },
    ],
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    <h1 className="sr-only">CINE3D - Xem phim trực tuyến chất lượng cao</h1>
    <HomeClient initialData={rewriteImageUrls(await loadHomeData())} />
  </>;
}
