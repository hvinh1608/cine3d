import CinemaLobby from '../../components/canvas/CinemaLobby';
import type { Movie } from '../../types/movie';

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export const metadata = { title: 'Sảnh điện ảnh 3D | CINE3D', description: 'Khám phá phim nổi bật trong sảnh điện ảnh 3D tương tác.' };

export default async function CinemaPage() {
  let movies: Movie[] = [];
  try {
    const response = await fetch(`${API_URL}/movies/home`, { next: { revalidate: 60 } });
    if (response.ok) {
      const data = await response.json();
      movies = [...(data.trending || []), ...(data.proposed || []), ...(data.movies || [])]
        .filter((movie: Movie, index: number, list: Movie[]) => movie?.posterUrl && list.findIndex((item) => item.id === movie.id) === index)
        .slice(0, 6);
    }
  } catch { /* The empty-state below keeps the route usable while the API wakes up. */ }

  return <main className="mx-auto w-full max-w-[1500px] flex-1 px-3 pb-12 pt-5 md:px-8 md:pt-8">
    {movies.length ? <CinemaLobby movies={movies} /> : <div className="flex min-h-[540px] items-center justify-center rounded-[2rem] border border-white/10 bg-slate-950 text-sm text-slate-400">Sảnh đang chuẩn bị poster, vui lòng quay lại sau.</div>}
  </main>;
}
