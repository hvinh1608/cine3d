import type { Metadata } from 'next';
import SearchClient, { type SearchInitialData } from '../../components/search/SearchClient';

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const query = first((await searchParams).q).trim();
  return {
    title: query ? `Tìm phim “${query}” | CINE3D` : 'Khám phá phim | CINE3D',
    description: query ? `Kết quả tìm kiếm phim ${query} trên CINE3D.` : 'Tìm phim theo tên, thể loại, quốc gia và năm phát hành trên CINE3D.',
  };
}

async function loadSearchData(rawParams: Record<string, string | string[] | undefined>): Promise<SearchInitialData> {
  const params = new URLSearchParams({ page: first(rawParams.page) || '1', limit: '24' });
  for (const key of ['q', 'genre', 'country', 'year', 'type', 'sortBy', 'status', 'vip', 'dubbed'] as const) {
    const value = first(rawParams[key]);
    if (value) params.set(key === 'q' ? 'search' : key, value);
  }

  const [moviesResult, genresResult, countriesResult] = await Promise.allSettled([
    fetch(`${API_URL}/movies?${params}`, { next: { revalidate: 60 } }).then(async (response) => {
      if (!response.ok) throw new Error(`Movies API returned ${response.status}`);
      return response.json();
    }),
    fetch(`${API_URL}/genres`, { next: { revalidate: 3600 } }).then((response) => response.ok ? response.json() : []),
    fetch(`${API_URL}/countries`, { next: { revalidate: 3600 } }).then((response) => response.ok ? response.json() : []),
  ]);

  const movieData = moviesResult.status === 'fulfilled' ? moviesResult.value : {};
  const movies = Array.isArray(movieData.movies) ? movieData.movies : [];
  return {
    movies,
    genres: genresResult.status === 'fulfilled' && Array.isArray(genresResult.value) ? genresResult.value : [],
    countries: countriesResult.status === 'fulfilled' && Array.isArray(countriesResult.value) ? countriesResult.value : [],
    totalPages: Math.max(1, Number(movieData.totalPages) || 1),
    totalResults: Number(movieData.total) || movies.length,
    loadError: moviesResult.status === 'rejected' ? 'Không thể tải kết quả lúc này. Vui lòng thử lại.' : '',
  };
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const rawParams = await searchParams;
  return <SearchClient initialData={await loadSearchData(rawParams)} />;
}
