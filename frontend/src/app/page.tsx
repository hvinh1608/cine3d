import HomeClient, { type HomeInitialData } from '../components/home/HomeClient';
import { getSiteUrl } from '../lib/site';
import { rewriteImageUrls } from '../lib/image-url';

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

async function loadHomeData(): Promise<HomeInitialData> {
  const [homeResult, animeResult] = await Promise.allSettled([
    fetch(`${API_URL}/movies/home`, { next: { revalidate: 60 } }).then(async (response) => {
      if (!response.ok) throw new Error(`Home API returned ${response.status}`);
      return response.json();
    }),
    fetch(`${API_URL}/movies?type=hoathinh&limit=12`, { next: { revalidate: 60 } }).then(async (response) => {
      if (!response.ok) throw new Error(`Anime API returned ${response.status}`);
      return response.json();
    }),
  ]);

  const home = homeResult.status === 'fulfilled' ? homeResult.value : {};
  const anime = animeResult.status === 'fulfilled' ? animeResult.value : {};
  const failedSections = [homeResult, animeResult].filter((result) => result.status === 'rejected').length;

  return {
    banners: Array.isArray(home.banners) ? home.banners : [],
    trending: Array.isArray(home.trending) ? home.trending : [],
    proposed: Array.isArray(home.proposed) ? home.proposed : [],
    movies: Array.isArray(home.movies) ? home.movies : [],
    anime: Array.isArray(anime.movies) ? anime.movies : [],
    china: Array.isArray(home.countries?.china) ? home.countries.china : [],
    korea: Array.isArray(home.countries?.korea) ? home.countries.korea : [],
    vietnam: Array.isArray(home.countries?.vietnam) ? home.countries.vietnam : [],
    loadError: failedSections === 2
      ? 'Không tải được danh sách phim. Backend có thể đang khởi động, vui lòng thử lại.'
      : failedSections === 1
        ? 'Một phần nội dung tải chậm và đang tạm thời không hiển thị.'
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
    <HomeClient initialData={rewriteImageUrls(await loadHomeData())} />
  </>;
}
