'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from '@/components/ui/ResilientImage';
import api from '@/lib/api';
import { ChevronLeft, ChevronRight, Clapperboard, Heart, Medal, MessageSquare, Play, TrendingUp } from 'lucide-react';
import type { Movie } from '@/types/movie';

type CommunityMovie = Movie & { favoritesCount?: number };
type CommunityComment = { id: string; content: string; createdAt: string; likesCount: number; user: { id: string; username: string; avatar?: string | null; isVip?: boolean }; movie: { id: string; title: string; slug: string; posterUrl: string } | null };
type CommunityData = { topComments: CommunityComment[]; latestComments: CommunityComment[]; hotMovies: CommunityMovie[]; favoriteMovies: CommunityMovie[] };

const fallbackAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80';

function Ranking({ title, icon, movies }: { title: string; icon: React.ReactNode; movies: CommunityMovie[] }) {
  return <section className="min-w-0 border-white/10 p-6 lg:border-r lg:p-8"><h3 className="mb-6 flex items-center gap-2 text-lg font-black uppercase tracking-wide">{icon}{title}</h3><ol className="space-y-4">{movies.slice(0, 5).map((movie, index) => <li key={movie.id}><Link href={`/movies/${movie.slug}`} className="group grid grid-cols-[28px_20px_42px_minmax(0,1fr)] items-center gap-3"><b className="text-lg text-slate-600">{index + 1}.</b><TrendingUp className="h-4 w-4 text-lime-400" /><span className="relative h-12 w-9 overflow-hidden rounded"><Image src={movie.posterUrl} alt="" fill sizes="36px" className="object-cover" /></span><span className="truncate text-sm font-semibold group-hover:text-amber-300">{movie.title}</span></Link></li>)}</ol></section>;
}

export default function CommunityHub({ fallbackHot, fallbackFavorite }: { fallbackHot: Movie[]; fallbackFavorite: Movie[] }) {
  const [data, setData] = useState<CommunityData>({ topComments: [], latestComments: [], hotMovies: fallbackHot, favoriteMovies: fallbackFavorite });
  const [showPrevious, setShowPrevious] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => { let alive = true; api.get('/community/home').then(({ data: response }) => alive && setData(response)).catch(() => undefined); return () => { alive = false; }; }, []);
  const scroll = (direction: number) => rowRef.current?.scrollBy({ left: direction * 500, behavior: 'smooth' });
  const updatePreviousVisibility = () => setShowPrevious((rowRef.current?.scrollLeft ?? 0) > 1);
  if (!data.topComments.length && !data.latestComments.length && !data.hotMovies.length) return null;

  return <section className="mx-auto mt-14 w-full max-w-[1440px] px-4 md:px-8"><div className="overflow-hidden rounded-[26px] border border-white/10 bg-[#191b24]">
    <div className="p-6 md:p-8"><h2 className="mb-6 flex items-center gap-3 text-xl font-black uppercase tracking-wider"><Medal className="h-6 w-6 text-amber-300" /> Top bình luận</h2><div className="relative">{showPrevious && <button onClick={() => scroll(-1)} aria-label="Bình luận trước" className="absolute -left-10 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-[#171820] md:-left-12"><ChevronLeft /></button>}<div ref={rowRef} onScroll={updatePreviousVisibility} className="movie-row flex gap-4 overflow-x-auto">{data.topComments.map((comment) => <article key={comment.id} className="relative min-h-52 w-[310px] shrink-0 overflow-hidden rounded-xl bg-[#242630] p-5"><div className="absolute inset-0 opacity-15">{comment.movie && <Image src={comment.movie.posterUrl} alt="" fill sizes="310px" className="object-cover blur-xl" />}</div><div className="relative flex items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><Image src={comment.user.avatar || fallbackAvatar} alt="" width={54} height={54} className="h-14 w-14 rounded-full object-cover" /><b className="truncate">{comment.user.username} {comment.user.isVip && <span className="text-amber-300">∞</span>}</b></div>{comment.movie && <span className="relative h-24 w-16 shrink-0 overflow-hidden rounded-md"><Image src={comment.movie.posterUrl} alt={comment.movie.title} fill sizes="64px" className="object-cover" /></span>}</div><p className="relative mt-4 line-clamp-2 text-sm leading-6 text-slate-300">{comment.content}</p><div className="relative mt-5 flex items-center gap-5 text-xs text-slate-500"><span>● {comment.likesCount}</span><span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> Bình luận</span></div></article>)}</div><button onClick={() => scroll(1)} aria-label="Bình luận tiếp theo" className="absolute -right-10 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-[#171820] md:-right-12"><ChevronRight /></button></div></div>
    <div className="grid border-t border-white/10 lg:grid-cols-[1fr_1fr_1.35fr]"><Ranking title="Sôi nổi nhất" icon={<Clapperboard className="h-5 w-5 text-amber-300" />} movies={data.hotMovies.length ? data.hotMovies : fallbackHot} /><Ranking title="Yêu thích nhất" icon={<Heart className="h-5 w-5 fill-amber-300 text-amber-300" />} movies={data.favoriteMovies.length ? data.favoriteMovies : fallbackFavorite} /><section className="p-6 lg:p-8"><h3 className="mb-6 flex items-center gap-2 text-lg font-black uppercase tracking-wide"><MessageSquare className="h-5 w-5 text-amber-300" /> Bình luận mới</h3><div className="space-y-2">{data.latestComments.slice(0, 6).map((comment) => <article key={comment.id} className="flex gap-3 rounded-xl bg-[#111218] p-3"><Image src={comment.user.avatar || fallbackAvatar} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-full object-cover" /><div className="min-w-0"><p className="truncate text-xs"><b>{comment.user.username}</b> <span className="ml-1 text-slate-400">{comment.content}</span></p>{comment.movie && <Link href={`/movies/${comment.movie.slug}`} className="mt-2 flex items-center gap-1 truncate text-[10px] text-slate-500 hover:text-amber-300"><Play className="h-3 w-3 fill-amber-300 text-amber-300" /> {comment.movie.title}</Link>}</div></article>)}</div></section></div>
  </div></section>;
}
