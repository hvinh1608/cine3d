import Image from '@/components/ui/ResilientImage';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Sparkles } from 'lucide-react';
import { getSiteUrl } from '../../lib/site';
import SharePhimMoiButton from '../../components/movies/SharePhimMoiButton';

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

type MovieItem = {
  id: string;
  slug: string;
  title: string;
  englishTitle?: string | null;
  posterUrl: string;
  updatedAt?: string;
  releaseYear?: number;
  quality?: string;
  isSeries?: boolean;
};

export const revalidate = 1800;

export const metadata: Metadata = {
  title: 'Phim mới cập nhật | CINE3D',
  description: 'Danh sách phim mới và vừa cập nhật trên CINE3D trong 72 giờ gần nhất. Xem miễn phí, chất lượng HD.',
  alternates: { canonical: '/phim-moi' },
  openGraph: {
    title: 'Phim mới cập nhật | CINE3D',
    description: 'Phim mới và tập mới vừa lên sóng trên CINE3D.',
    url: '/phim-moi',
    type: 'website',
  },
};

export default async function PhimMoiPage() {
  const siteUrl = getSiteUrl();
  let movies: MovieItem[] = [];
  try {
    const response = await fetch(`${API_URL}/movies?sortBy=updatedAt&limit=48&page=1`, {
      next: { revalidate: 1800 },
    });
    if (response.ok) {
      const data = await response.json();
      const list: MovieItem[] = Array.isArray(data?.movies) ? data.movies : [];
      const cutoff = Date.now() - 72 * 60 * 60 * 1000;
      movies = list.filter((movie) => {
        if (!movie.updatedAt) return true;
        const ts = new Date(movie.updatedAt).getTime();
        return Number.isFinite(ts) ? ts >= cutoff : true;
      });
      if (movies.length < 12) movies = list.slice(0, 48);
    }
  } catch {
    // Keep empty state when catalog API is temporarily unavailable.
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8">
      <header className="mb-8 overflow-hidden rounded-3xl border border-amber-400/10 bg-gradient-to-br from-amber-400/10 via-slate-950 to-cyan-500/10 p-6 md:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-400">Cập nhật liên tục</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-black md:text-4xl">
          <Sparkles className="h-9 w-9 text-amber-400" /> Phim mới
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          Những bộ phim và tập mới vừa được cập nhật trên CINE3D trong 24–72 giờ gần đây. Chia sẻ trang này để bạn bè không bỏ lỡ.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-300">
            {movies.length} phim
          </span>
          <SharePhimMoiButton siteUrl={siteUrl} />
        </div>
      </header>

      {movies.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {movies.map((movie) => (
            <Link
              key={movie.id || movie.slug}
              href={`/movies/${movie.slug}?utm_source=phim_moi&utm_medium=seo&utm_campaign=phim_moi`}
              className="group overflow-hidden rounded-2xl border border-white/5 bg-slate-950/70 transition hover:border-amber-400/30"
            >
              <div className="relative aspect-[2/3] overflow-hidden bg-slate-900">
                <Image
                  src={movie.posterUrl}
                  alt={movie.title}
                  fill
                  sizes="(max-width: 768px) 45vw, 160px"
                  className="object-cover transition duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-2.5">
                <h2 className="line-clamp-2 text-xs font-bold leading-4 text-white">{movie.title}</h2>
                <p className="mt-1 text-[10px] text-slate-500">
                  {movie.releaseYear || '—'}
                  {movie.quality ? ` · ${movie.quality}` : ''}
                  {movie.isSeries ? ' · Series' : ''}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 py-14 text-center text-sm text-slate-500">
          Chưa có phim mới trong khung thời gian này.
        </div>
      )}
    </main>
  );
}
