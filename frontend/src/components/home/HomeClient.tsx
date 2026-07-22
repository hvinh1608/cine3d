'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from '@/components/ui/ResilientImage';
import { Check, ChevronLeft, ChevronRight, CircleAlert, Info, Play, Plus, Star, X } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { toggleFavorite } from '@/lib/user-library';
import api from '@/lib/api';
import MovieCard3D from '@/components/ui/MovieCard3D';
import CommunityHub from '@/components/home/CommunityHub';
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
    <MovieCard3D movie={movie} isFavorited={favorite} onToggleFavorite={(id, item) => void toggleFavorite(id, item)} />
    <div className="mt-3 min-w-0"><Link href={`/movies/${movie.slug}`} className="block truncate text-sm font-bold text-white hover:text-amber-300">{movie.title}</Link><p className="mt-1 truncate text-[10px] text-slate-500">{movie.englishTitle || `${movie.releaseYear} · ${movie.isSeries ? 'Phim bộ' : 'Phim lẻ'}`}</p></div>
  </article>;
}

function AnimeSpotlight({ movies, favoriteIds }: { movies: Movie[]; favoriteIds: Set<string> }) {
  const [index, setIndex] = useState(0);
  const anime = movies[index];
  useEffect(() => {
    if (movies.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % movies.length), 8000);
    return () => window.clearInterval(timer);
  }, [movies.length]);
  if (!anime) return null;
  return <section className="mx-auto mb-24 mt-14 w-full max-w-[1440px] px-4 md:px-8">
    <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-black text-violet-300 md:text-2xl">Kho tàng Anime mới nhất</h2><Link href="/search?type=hoathinh" className="flex items-center gap-1 text-xs font-bold text-slate-400">Xem tất cả <ChevronRight className="h-4 w-4" /></Link></div>
    <div className="relative min-h-[500px] overflow-visible rounded-[28px] border border-white/[.08] bg-[#20222e] shadow-[0_30px_90px_rgba(0,0,0,.42)] md:h-[540px]">
      <div className="absolute inset-0 overflow-hidden rounded-[28px]"><Image src={anime.backdropUrl || anime.posterUrl} alt={anime.title} fill sizes="1440px" className="object-cover object-center md:object-[65%_center]" /><div className="absolute inset-0 bg-gradient-to-r from-[#20222e] via-[#20222e]/90 to-transparent md:via-[43%] md:to-[78%]" /><div className="absolute inset-0 bg-gradient-to-t from-[#20222e] via-transparent to-black/20" /><div className="absolute inset-0 opacity-[.1] [background-image:radial-gradient(rgba(255,255,255,.6)_.7px,transparent_.7px)] [background-size:4px_4px]" /></div>
      <div className="relative z-10 flex min-h-[500px] max-w-2xl flex-col justify-center px-6 pb-36 pt-10 md:h-full md:px-12 md:pb-40 lg:px-14">
        <h3 className="text-3xl font-black md:text-4xl">{anime.title}</h3>{anime.englishTitle && <p className="mt-2 text-base text-amber-300">{anime.englishTitle}</p>}
        <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-bold"><span className="rounded border border-amber-300 px-2.5 py-1.5">IMDb {anime.ratingAvg?.toFixed(1) || '0.0'}</span><span className="rounded bg-white px-2.5 py-1.5 text-black">T16</span><span className="rounded border border-white/40 px-2.5 py-1.5">{anime.releaseYear}</span><span className="rounded border border-white/40 px-2.5 py-1.5">{anime.isSeries ? 'Phần 1' : 'Movie'}</span><span className="rounded border border-white/40 px-2.5 py-1.5">{anime.isSeries ? `Tập ${anime.episodeCount}` : 'Full'}</span></div>
        <span className="mt-4 w-fit rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-bold">Hoạt hình</span><p className="mt-5 line-clamp-4 text-sm leading-7 text-slate-200">{anime.description || 'Thông tin phim đang được cập nhật.'}</p>
        <div className="mt-6 flex items-center gap-4"><Link href={`/movies/${anime.slug}`} className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-amber-100 to-amber-400 text-black shadow-xl"><Play className="ml-1 h-7 w-7 fill-current" /></Link><button onClick={() => void toggleFavorite(anime.id, anime)} className="grid h-12 w-14 place-items-center rounded-l-full border border-white/15 bg-black/20">{favoriteIds.has(anime.id) ? <Check className="text-emerald-400" /> : <Plus />}</button><Link href={`/movies/${anime.slug}`} className="-ml-4 grid h-12 w-14 place-items-center rounded-r-full border border-l-0 border-white/15 bg-black/20"><CircleAlert /></Link></div>
      </div>
      <div className="movie-row absolute -bottom-14 left-[5%] right-[2%] z-20 flex gap-3 overflow-x-auto px-2 py-2 md:gap-4">{movies.map((item, itemIndex) => <button key={item.id} onClick={() => setIndex(itemIndex)} className={`relative aspect-[2/3] h-[96px] shrink-0 overflow-hidden rounded-xl border-[3px] bg-slate-900 shadow-xl transition hover:-translate-y-1 md:h-[120px] ${index === itemIndex ? '-translate-y-1 border-white ring-2 ring-amber-300' : 'border-[#303340] opacity-85'}`}><Image src={item.posterUrl} alt={item.title} fill sizes="80px" className="object-cover" /></button>)}</div>
    </div>
  </section>;
}

function MovieRow({ title, movies, href = '/search', favoriteIds, accent = 'text-amber-300' }: { title: string; movies: Movie[]; href?: string; favoriteIds: Set<string>; accent?: string }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [showPrevious, setShowPrevious] = useState(false);
  if (!movies.length) return null;
  const scroll = (direction: number) => rowRef.current?.scrollBy({ left: direction * Math.max(600, rowRef.current.clientWidth * .8), behavior: 'smooth' });
  const updatePreviousVisibility = () => setShowPrevious((rowRef.current?.scrollLeft ?? 0) > 1);
  return <section className="mx-auto mt-11 w-full max-w-[1440px] px-4 md:px-8">
    <div className="mb-5 flex items-center justify-between"><h2 className={`text-xl font-black md:text-2xl ${accent}`}>{title}</h2><Link href={href} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white">Xem tất cả <ChevronRight className="h-4 w-4" /></Link></div>
    <div className="relative">{showPrevious && <button onClick={() => scroll(-1)} aria-label="Phim trước" className="absolute -left-3 top-[38%] z-20 hidden h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-xl hover:bg-amber-300 md:flex"><ChevronLeft /></button>}<div ref={rowRef} onScroll={updatePreviousVisibility} className="movie-row flex gap-4 overflow-x-auto pb-3 md:gap-5">{movies.map((movie) => <MovieCard key={movie.id} movie={movie} favorite={favoriteIds.has(movie.id)} />)}</div><button onClick={() => scroll(1)} aria-label="Phim tiếp theo" className="absolute -right-3 top-[38%] z-20 hidden h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-xl hover:bg-amber-300 md:flex"><ChevronRight /></button></div>
  </section>;
}

type WatchHistoryItem = ReturnType<typeof useStore.getState>['watchHistory'][number];

function ContinueWatching({ history, onRemove }: { history: WatchHistoryItem[]; onRemove: (id: string) => void }) {
  return <section className="relative z-10 mx-auto mt-8 w-full max-w-[1440px] px-4 md:px-8">
    <div className="mb-5 flex items-center gap-3"><span className="h-6 w-1 rounded-full bg-gradient-to-b from-red-500 to-amber-300" /><h2 className="text-xl font-black text-white md:text-2xl">Tiếp tục xem</h2></div>
    <div className="movie-row flex gap-4 overflow-x-auto pb-3 md:gap-5">{history.slice(0, 8).map((item) => {
      const progress = item.duration > 0 ? Math.min(100, Math.round((item.watchedTime / item.duration) * 100)) : 0;
      const episode = item.movie.episodes?.find((entry) => entry.id === item.episodeId);
      const watchUrl = `/watch/${item.movie.slug}${episode ? `?ep=${episode.episodeOrder}` : ''}`;
      return <article key={item.id} className="group relative aspect-video w-[260px] shrink-0 overflow-hidden rounded-xl border border-white/[.07] bg-slate-900 shadow-lg sm:w-[310px]">
        <Link href={watchUrl} aria-label={`Tiếp tục xem ${item.movie.title}`} className="absolute inset-0 z-10" />
        <Image src={item.movie.backdropUrl || item.movie.posterUrl} alt={item.movie.title} fill sizes="310px" className="object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        <button type="button" onClick={() => onRemove(item.id)} aria-label={`Xóa ${item.movie.title} khỏi tiếp tục xem`} className="absolute right-2 top-2 z-20 grid h-8 w-8 place-items-center rounded-full bg-black/70 text-slate-300 transition hover:bg-red-600 hover:text-white md:opacity-0 md:group-hover:opacity-100"><X className="h-4 w-4" /></button>
        <div className="absolute inset-x-0 bottom-0 z-10 p-3"><b className="block truncate text-sm text-white">{item.movie.title}</b><p className="mt-1 text-[10px] text-slate-400">{episode?.title || 'Tiếp tục từ vị trí đã xem'} · {progress}%</p><div className="mt-2 h-1 overflow-hidden rounded-full bg-white/20"><span className="block h-full rounded-full bg-amber-300" style={{ width: `${progress}%` }} /></div></div>
      </article>;
    })}</div>
  </section>;
}

export default function HomeClient({ initialData }: { initialData: HomeInitialData }) {
  const { favoriteIds, user, watchHistory, setWatchHistory, selectedProfileId, showToast } = useStore();
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

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    api.get('/user/history', { signal: controller.signal }).then(({ data }) => {
      const rows = Array.isArray(data) ? data as WatchHistoryItem[] : [];
      setWatchHistory(rows.filter((item) => item.watchedTime > 0 && (item.duration <= 0 || item.watchedTime / item.duration < 0.95)));
    }).catch(() => undefined);
    return () => controller.abort();
  }, [selectedProfileId, setWatchHistory, user]);

  const removeHistory = async (historyId: string) => {
    setWatchHistory(watchHistory.filter((item) => item.id !== historyId));
    try {
      await api.delete(`/user/history/${historyId}`);
      showToast('Đã xóa khỏi danh sách tiếp tục xem.', 'success');
    } catch {
      showToast('Không thể xóa lịch sử xem lúc này.', 'error');
    }
  };

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

    {user && watchHistory.length > 0 && <ContinueWatching history={watchHistory} onRemove={(id) => void removeHistory(id)} />}

    <section className="relative z-10 mx-auto mt-2 w-full max-w-[1440px] px-4 pt-5 md:px-8"><h2 className="mb-5 text-xl font-black text-amber-300 md:text-2xl">Bạn đang quan tâm gì?</h2><div className="movie-row flex gap-3 overflow-x-auto pb-3">{topics.map(([title, subtitle, gradient, slug]) => <Link key={title} href={`/the-loai/${slug}`} className={`relative h-28 w-48 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br ${gradient} p-5 shadow-lg transition hover:-translate-y-1 sm:w-56`}><b className="block text-xl">{title}</b><span className="mt-1 block text-xs text-white/65">{subtitle}</span><ChevronRight className="absolute bottom-4 right-4 h-5 w-5 text-white/70" /><span className="absolute -bottom-12 -right-8 h-28 w-28 rounded-full bg-white/10" /></Link>)}</div></section>

    <MovieRow title="Đề xuất cho bạn" movies={initialData.proposed} favoriteIds={favorites} accent="text-amber-300" />

    {!!initialData.trending.length && <section className="mx-auto mt-12 w-full max-w-[1440px] px-4 md:px-8"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-black text-rose-400 md:text-2xl">Top phim hôm nay</h2><Link href="/search?sortBy=views" className="flex items-center gap-1 text-xs font-bold text-slate-400">Xem tất cả <ChevronRight className="h-4 w-4" /></Link></div><div className="movie-row flex gap-5 overflow-x-auto pb-4">{initialData.trending.slice(0, 10).map((movie, index) => <Link key={movie.id} href={`/movies/${movie.slug}`} className="group flex w-[270px] shrink-0 items-end"><span className="relative z-10 -mr-3 text-[92px] font-black leading-none text-transparent [-webkit-text-stroke:2px_rgba(255,255,255,.55)]">{index + 1}</span><span className="relative block aspect-[2/3] w-32 overflow-hidden rounded-lg bg-[#252735]"><Image src={movie.posterUrl} alt={movie.title} fill sizes="128px" className="object-cover transition group-hover:scale-105" /></span><span className="min-w-0 flex-1 pb-2 pl-3"><b className="line-clamp-2 text-sm group-hover:text-amber-300">{movie.title}</b><small className="mt-2 block text-[10px] text-slate-500">{movie.quality} · {movie.releaseYear}</small></span></Link>)}</div></section>}

    <MovieRow title="Phim mới cập nhật" movies={initialData.movies} href="/search?sortBy=createdAt" favoriteIds={favorites} accent="text-sky-300" />
    <AnimeSpotlight movies={initialData.anime} favoriteIds={favorites} />
    <MovieRow title="Phim Trung Quốc mới" movies={initialData.china} href="/quoc-gia/trung-quoc" favoriteIds={favorites} accent="text-red-300" />
    <MovieRow title="Phim Hàn Quốc mới" movies={initialData.korea} href="/quoc-gia/han-quoc" favoriteIds={favorites} accent="text-pink-300" />
    <MovieRow title="Phim Việt Nam mới" movies={initialData.vietnam} href="/quoc-gia/viet-nam" favoriteIds={favorites} accent="text-emerald-300" />
    <CommunityHub fallbackHot={initialData.trending} fallbackFavorite={initialData.proposed} />
  </main>;
}
