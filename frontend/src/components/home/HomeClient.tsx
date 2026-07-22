'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from '@/components/ui/ResilientImage';
import { ChevronLeft, ChevronRight, Heart, Info, Play, Plus, Star } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { toggleFavorite } from '@/lib/user-library';
import type { Banner, Movie } from '@/types/movie';

export type HomeInitialData = {
  banners: Banner[];
  trending: Movie[];
  proposed: Movie[];
  movies: Movie[];
  anime: Movie[];
  china: Movie[];
  korea: Movie[];
  vietnam: Movie[];
  loadError?: string;
};

const topics = [
  ['Marvel', 'Siêu anh hùng', 'from-violet-600 to-indigo-950', 'vien-tuong'],
  ['4K', 'Mãn nhãn', 'from-fuchsia-600 to-purple-950', 'vien-tuong'],
  ['Cổ trang', 'Kiếm hiệp', 'from-cyan-500 to-blue-950', 'co-trang'],
  ['Tình cảm', 'Ngọt ngào', 'from-pink-500 to-rose-950', 'tinh-cam'],
  ['Kinh dị', 'Rùng rợn', 'from-orange-500 to-red-950', 'kinh-di'],
  ['Hoạt hình', 'Cho cả nhà', 'from-emerald-500 to-teal-950', 'hoat-hinh'],
] as const;

function MovieCard({ movie, favorite }: { movie: Movie; favorite: boolean }) {
  return <article className="group w-[145px] shrink-0 sm:w-[170px] lg:w-[185px]">
    <Link href={`/movies/${movie.slug}`} className="relative block aspect-[2/3] overflow-hidden rounded-lg bg-[#242632]">
      <Image src={movie.posterUrl} alt={movie.title} fill sizes="185px" className="object-cover transition duration-500 group-hover:scale-105" />
      <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
      <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-1 text-[9px] font-black text-amber-300 backdrop-blur">{movie.quality || 'HD'}</span>
      <span className="absolute inset-0 grid place-items-center bg-black/25 opacity-0 transition group-hover:opacity-100"><span className="grid h-12 w-12 place-items-center rounded-full bg-amber-300 text-black"><Play className="ml-0.5 h-5 w-5 fill-current" /></span></span>
    </Link>
    <div className="mt-3 flex gap-2"><div className="min-w-0 flex-1"><Link href={`/movies/${movie.slug}`} className="block truncate text-sm font-bold text-white hover:text-amber-300">{movie.title}</Link><p className="mt-1 truncate text-[10px] text-slate-500">{movie.englishTitle || `${movie.releaseYear} · ${movie.isSeries ? 'Phim bộ' : 'Phim lẻ'}`}</p></div><button onClick={() => void toggleFavorite(movie.id, movie)} aria-label={favorite ? 'Bỏ yêu thích' : 'Yêu thích'} className={`h-fit pt-0.5 ${favorite ? 'text-rose-400' : 'text-slate-600 hover:text-white'}`}><Heart className={`h-4 w-4 ${favorite ? 'fill-current' : ''}`} /></button></div>
  </article>;
}

function MovieRow({ title, movies, href = '/search', favoriteIds, accent = 'text-amber-300' }: { title: string; movies: Movie[]; href?: string; favoriteIds: Set<string>; accent?: string }) {
  const rowRef = useRef<HTMLDivElement>(null);
  if (!movies.length) return null;
  const scroll = (direction: number) => rowRef.current?.scrollBy({ left: direction * Math.max(600, rowRef.current.clientWidth * .8), behavior: 'smooth' });
  return <section className="mx-auto mt-11 w-full max-w-[1440px] px-4 md:px-8">
    <div className="mb-5 flex items-center justify-between"><h2 className={`text-xl font-black md:text-2xl ${accent}`}>{title}</h2><Link href={href} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white">Xem tất cả <ChevronRight className="h-4 w-4" /></Link></div>
    <div className="relative"><button onClick={() => scroll(-1)} aria-label="Phim trước" className="absolute -left-3 top-[38%] z-20 hidden h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-xl hover:bg-amber-300 md:flex"><ChevronLeft /></button><div ref={rowRef} className="movie-row flex gap-4 overflow-x-auto pb-3 md:gap-5">{movies.map((movie) => <MovieCard key={movie.id} movie={movie} favorite={favoriteIds.has(movie.id)} />)}</div><button onClick={() => scroll(1)} aria-label="Phim tiếp theo" className="absolute -right-3 top-[38%] z-20 hidden h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-xl hover:bg-amber-300 md:flex"><ChevronRight /></button></div>
  </section>;
}

export default function HomeClient({ initialData }: { initialData: HomeInitialData }) {
  const { favoriteIds } = useStore();
  const favorites = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const [heroIndex, setHeroIndex] = useState(0);
  const fallback = initialData.movies[0] || initialData.proposed[0] || initialData.trending[0];
  const heroes = useMemo(() => initialData.banners.length ? initialData.banners.slice(0, 6) : fallback ? [{ id: fallback.id, title: fallback.title, description: fallback.description || '', imageUrl: fallback.backdropUrl, movie: fallback }] : [], [fallback, initialData.banners]);
  const active = heroes[heroIndex];

  useEffect(() => {
    if (heroes.length < 2) return;
    const timer = window.setInterval(() => setHeroIndex((index) => (index + 1) % heroes.length), 8000);
    return () => window.clearInterval(timer);
  }, [heroes.length]);

  return <main className="-mt-20 min-h-screen bg-[#171820] pb-20 text-white">
    {active && <section className="relative min-h-[650px] overflow-hidden md:min-h-[760px]">
      <Image src={active.imageUrl || active.movie.posterUrl} alt={active.title} fill priority sizes="100vw" className="object-cover object-center" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#171820_0%,rgba(23,24,32,.78)_30%,rgba(23,24,32,.12)_72%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(23,24,32,.15)_0%,rgba(23,24,32,0)_46%,#171820_100%)]" />
      <div className="relative mx-auto flex min-h-[650px] max-w-[1440px] items-end px-4 pb-28 pt-32 md:min-h-[760px] md:px-8 md:pb-36">
        <div className="max-w-2xl">
          <p className="mb-4 text-xs font-black uppercase tracking-[.28em] text-amber-300">CINE3D · Phim nổi bật</p>
          <h1 className="text-4xl font-black leading-[.98] drop-shadow-2xl sm:text-6xl lg:text-7xl">{active.title}</h1>
          {active.movie.englishTitle && <p className="mt-3 text-lg font-semibold text-amber-200">{active.movie.englishTitle}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] font-bold"><span className="flex items-center gap-1 rounded bg-amber-300 px-2.5 py-1.5 text-black"><Star className="h-3 w-3 fill-current" /> {Number(active.movie.ratingAvg || 0).toFixed(1)}</span><span className="rounded border border-white/30 px-2.5 py-1.5">{active.movie.releaseYear}</span><span className="rounded border border-white/30 px-2.5 py-1.5">{active.movie.quality || 'HD'}</span><span className="rounded border border-white/30 px-2.5 py-1.5">{active.movie.isSeries ? 'Phim bộ' : 'Phim lẻ'}</span>{active.movie.movieGenres?.slice(0, 2).map(({ genre }) => <span key={genre.slug} className="rounded-full bg-white/10 px-3 py-1.5">{genre.name}</span>)}</div>
          <p className="mt-5 line-clamp-3 max-w-xl text-sm leading-7 text-slate-300 drop-shadow">{active.description || active.movie.description}</p>
          <div className="mt-7 flex items-center gap-3"><Link href={`/watch/${active.movie.slug}`} className="flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-200 to-amber-400 px-7 py-3.5 text-sm font-black text-black shadow-[0_10px_30px_rgba(251,191,36,.2)] hover:brightness-110"><Play className="h-5 w-5 fill-current" /> Xem ngay</Link><Link href={`/movies/${active.movie.slug}`} className="grid h-12 w-12 place-items-center rounded-full bg-white/15 backdrop-blur hover:bg-white/25"><Info className="h-5 w-5" /></Link><button onClick={() => void toggleFavorite(active.movie.id, active.movie)} className="grid h-12 w-12 place-items-center rounded-full bg-white/15 backdrop-blur hover:bg-white/25"><Plus className="h-5 w-5" /></button></div>
        </div>
      </div>
      {heroes.length > 1 && <div className="absolute bottom-11 right-4 hidden max-w-[48%] gap-3 md:flex lg:right-10">{heroes.map((banner, index) => <button key={banner.id} onClick={() => setHeroIndex(index)} className={`relative aspect-video w-28 overflow-hidden rounded-lg border-2 transition lg:w-36 ${index === heroIndex ? 'border-amber-300 opacity-100' : 'border-transparent opacity-55 hover:opacity-100'}`}><Image src={banner.imageUrl || banner.movie.posterUrl} alt={banner.title} fill sizes="144px" className="object-cover" /></button>)}</div>}
    </section>}

    {initialData.loadError && <div className="mx-auto max-w-[1440px] px-4 md:px-8"><p className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-200">{initialData.loadError}</p></div>}

    <section className="mx-auto -mt-7 w-full max-w-[1440px] px-4 md:px-8"><h2 className="mb-5 text-xl font-black text-amber-300 md:text-2xl">Bạn đang quan tâm gì?</h2><div className="movie-row flex gap-3 overflow-x-auto pb-3">{topics.map(([title, subtitle, gradient, slug]) => <Link key={title} href={`/the-loai/${slug}`} className={`relative h-28 w-48 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br ${gradient} p-5 shadow-lg transition hover:-translate-y-1 sm:w-56`}><b className="block text-xl">{title}</b><span className="mt-1 block text-xs text-white/65">{subtitle}</span><ChevronRight className="absolute bottom-4 right-4 h-5 w-5 text-white/70" /><span className="absolute -bottom-12 -right-8 h-28 w-28 rounded-full bg-white/10" /></Link>)}</div></section>

    <MovieRow title="Đề xuất cho bạn" movies={initialData.proposed} favoriteIds={favorites} accent="text-amber-300" />

    {!!initialData.trending.length && <section className="mx-auto mt-12 w-full max-w-[1440px] px-4 md:px-8"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-black text-rose-400 md:text-2xl">Top phim hôm nay</h2><Link href="/search?sortBy=views" className="flex items-center gap-1 text-xs font-bold text-slate-400">Xem tất cả <ChevronRight className="h-4 w-4" /></Link></div><div className="movie-row flex gap-5 overflow-x-auto pb-4">{initialData.trending.slice(0, 10).map((movie, index) => <Link key={movie.id} href={`/movies/${movie.slug}`} className="group flex w-[270px] shrink-0 items-end"><span className="relative z-10 -mr-3 text-[92px] font-black leading-none text-transparent [-webkit-text-stroke:2px_rgba(255,255,255,.55)]">{index + 1}</span><span className="relative block aspect-[2/3] w-32 overflow-hidden rounded-lg bg-[#252735]"><Image src={movie.posterUrl} alt={movie.title} fill sizes="128px" className="object-cover transition group-hover:scale-105" /></span><span className="min-w-0 flex-1 pb-2 pl-3"><b className="line-clamp-2 text-sm group-hover:text-amber-300">{movie.title}</b><small className="mt-2 block text-[10px] text-slate-500">{movie.quality} · {movie.releaseYear}</small></span></Link>)}</div></section>}

    <MovieRow title="Phim mới cập nhật" movies={initialData.movies} href="/search?sortBy=createdAt" favoriteIds={favorites} accent="text-sky-300" />
    <MovieRow title="Kho tàng Anime" movies={initialData.anime} href="/search?type=hoathinh" favoriteIds={favorites} accent="text-violet-300" />
    <MovieRow title="Phim Trung Quốc mới" movies={initialData.china} href="/quoc-gia/trung-quoc" favoriteIds={favorites} accent="text-red-300" />
    <MovieRow title="Phim Hàn Quốc mới" movies={initialData.korea} href="/quoc-gia/han-quoc" favoriteIds={favorites} accent="text-pink-300" />
    <MovieRow title="Phim Việt Nam mới" movies={initialData.vietnam} href="/quoc-gia/viet-nam" favoriteIds={favorites} accent="text-emerald-300" />
  </main>;
}
