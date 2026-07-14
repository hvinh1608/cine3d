import HomeClient, { type HomeInitialData } from '../components/home/HomeClient';

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
    loadError: failedSections === 2
      ? 'Không tải được danh sách phim. Backend có thể đang khởi động, vui lòng thử lại.'
      : failedSections === 1
        ? 'Một phần nội dung tải chậm và đang tạm thời không hiển thị.'
        : '',
  };
}

export default async function HomePage() {
  return <HomeClient initialData={await loadHomeData()} />;
}
