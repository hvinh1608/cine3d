'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from '@/components/ui/ResilientImage';
import { Crown, Lock, Server } from 'lucide-react';
import api from '../../lib/api';
import type { Episode, Movie, VideoSource } from '../../types/movie';

type PlaybackEpisode = Episode & { premiumSourcesLocked?: number };
type PlaybackMovie = Movie & { requiresVip?: boolean; isEarlyAccess?: boolean; episodes: PlaybackEpisode[] };

export default function WatchSidebar({ movie, activeEpisode, activeSource, user, onSourceChange }: { movie: PlaybackMovie; activeEpisode: PlaybackEpisode; activeSource: VideoSource | null; user: { isVip?: boolean } | null; onSourceChange: (source: VideoSource) => void }) {
  const [suggestions, setSuggestions] = useState<Movie[]>([]);
  useEffect(() => {
    const genre = movie.movieGenres?.[0]?.genre.slug;
    let alive = true;
    api.get('/movies', { params: { genre, limit: 10 } }).then(({ data }) => alive && setSuggestions((data.movies || []).filter((item: Movie) => item.id !== movie.id).slice(0, 8))).catch(() => undefined);
    return () => { alive = false; };
  }, [movie.id, movie.movieGenres]);

  return <aside className="space-y-7 text-left">
    <section className="border-b border-white/5 pb-6"><h3 className="mb-4 flex items-center gap-2 text-sm font-bold"><Server className="h-4 w-4 text-amber-300" /> Server phát</h3><div className="flex flex-wrap gap-2">{movie.requiresVip ? <p className="text-xs text-amber-300">Nguồn phát yêu cầu VIP.</p> : activeEpisode.videoSources?.map((source) => <button key={source.id} onClick={() => onSourceChange(source)} className={`rounded-md border px-3 py-2 text-[10px] font-bold ${activeSource?.id === source.id ? 'border-amber-300 bg-amber-300 text-black' : 'border-white/5 bg-[#252735] text-slate-400'}`}>{source.server} · {source.quality}{source.isPremium && <Crown className="ml-1 inline h-3 w-3" />}</button>)}</div>{!movie.requiresVip && (activeEpisode.premiumSourcesLocked || 0) > 0 && !user?.isVip && <Link href="/vip" className="mt-3 flex items-center gap-2 text-[10px] font-bold text-amber-300"><Lock className="h-3 w-3" /> Mở khóa nguồn Premium/4K</Link>}</section>
    {!!movie.movieActors?.length && <section className="border-b border-white/5 pb-7"><h3 className="mb-5 text-lg font-bold">Diễn viên</h3><div className="grid grid-cols-3 gap-4">{movie.movieActors.slice(0, 6).map(({ actor }) => <Link key={actor.name} href={actor.slug ? `/actors/${actor.slug}` : '#'} className="min-w-0 text-center"><span className="mx-auto grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-[#292b38] text-sm font-bold text-slate-400">{actor.avatarUrl ? <Image src={actor.avatarUrl} alt={actor.name} width={48} height={48} className="h-full w-full object-cover" /> : actor.name.charAt(0)}</span><span className="mt-2 block truncate text-[9px] text-slate-400">{actor.name}</span></Link>)}</div></section>}
    {!!suggestions.length && <section><h3 className="mb-4 text-lg font-bold">Đề xuất cho bạn</h3><div className="space-y-2">{suggestions.map((item) => <Link key={item.id} href={`/movies/${item.slug}`} className="flex gap-3 rounded-lg bg-[#20222d] p-2 transition hover:bg-[#282a38]"><span className="relative h-20 w-14 shrink-0 overflow-hidden rounded"><Image src={item.posterUrl} alt={item.title} fill sizes="56px" className="object-cover" /></span><span className="min-w-0 py-1"><b className="block truncate text-xs">{item.title}</b>{item.englishTitle && <small className="mt-1 block truncate text-[9px] text-slate-500">{item.englishTitle}</small>}<small className="mt-2 block text-[9px] text-slate-400">{item.quality || 'HD'} · {item.releaseYear}</small></span></Link>)}</div></section>}
  </aside>;
}
