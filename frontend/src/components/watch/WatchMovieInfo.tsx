'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from '@/components/ui/ResilientImage';
import { ChevronDown, Flag, Heart, Info, LightbulbOff, ListVideo, PictureInPicture2, Play, Search, Share2, Users, Wifi } from 'lucide-react';
import type { Episode, Movie } from '../../types/movie';

type PlaybackEpisode = Episode & { premiumSourcesLocked?: number };
type PlaybackMovie = Movie & { requiresVip?: boolean; isEarlyAccess?: boolean; episodes: PlaybackEpisode[] };

interface Props {
  movie: PlaybackMovie;
  activeEpisode: PlaybackEpisode;
  activeEpOrder: number;
  user: { isVip?: boolean } | null;
  lightsOff: boolean;
  dataSaver: boolean;
  onToggleLights: () => void;
  onToggleDataSaver: () => void;
  onPictureInPicture: () => void;
  onReportPlayback: () => void;
  onCopyLink: () => void;
}

export default function WatchMovieInfo({ movie, activeEpisode, activeEpOrder, lightsOff, dataSaver, onToggleLights, onToggleDataSaver, onPictureInPicture, onReportPlayback, onCopyLink }: Props) {
  const [episodeQuery, setEpisodeQuery] = useState('');
  const [selectedSeason, setSelectedSeason] = useState(activeEpisode.seasonNumber || 1);
  const seasons = useMemo(() => Array.from(new Set(movie.episodes.map((episode) => episode.seasonNumber || 1))).sort((a, b) => a - b), [movie.episodes]);
  const episodes = movie.episodes.filter((episode) => {
    const query = episodeQuery.trim().toLocaleLowerCase('vi');
    return (episode.seasonNumber || 1) === selectedSeason && (!query || episode.title.toLocaleLowerCase('vi').includes(query) || String(episode.episodeOrder) === query);
  });
  const actions = [
    { label: 'Yêu thích', icon: Heart, action: () => undefined },
    { label: 'Chia sẻ', icon: Share2, action: onCopyLink },
    { label: 'Xem chung', icon: Users, href: `/watch-together?slug=${encodeURIComponent(movie.slug)}&ep=${activeEpisode.episodeOrder}` },
    { label: lightsOff ? 'Bật đèn' : 'Tắt đèn', icon: LightbulbOff, action: onToggleLights, active: lightsOff },
    { label: 'Cửa sổ nổi', icon: PictureInPicture2, action: onPictureInPicture },
    { label: 'Báo lỗi', icon: Flag, action: onReportPlayback },
  ];

  return <>
    <div className="flex flex-wrap items-center gap-x-1 border-b border-white/5 bg-[#101117] px-2 py-1 text-[10px] font-semibold text-slate-400 sm:px-4">
      {actions.map(({ label, icon: Icon, action, href, active }) => href
        ? <Link key={label} href={href} className="flex items-center gap-1.5 px-3 py-3 hover:text-white"><Icon className="h-3.5 w-3.5" />{label}</Link>
        : <button key={label} onClick={action} className={`flex items-center gap-1.5 px-3 py-3 hover:text-white ${active ? 'text-amber-300' : ''}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}
      <button onClick={onToggleDataSaver} className={`ml-auto hidden items-center gap-1.5 px-3 py-3 sm:flex ${dataSaver ? 'text-emerald-300' : ''}`}><Wifi className="h-3.5 w-3.5" /> Tiết kiệm data</button>
    </div>

    <section className="grid gap-5 border-b border-white/5 py-6 md:grid-cols-[100px_minmax(0,1fr)_minmax(220px,.9fr)]">
      <Image src={movie.posterUrl} alt={movie.title} width={100} height={145} className="h-36 w-24 rounded-md object-cover shadow-xl" />
      <div className="min-w-0">
        <h1 className="text-xl font-bold">{movie.title}</h1>
        {movie.englishTitle && <p className="mt-1 text-xs text-amber-300">{movie.englishTitle}</p>}
        <div className="mt-4 flex flex-wrap gap-1.5 text-[9px] font-bold"><span className="rounded bg-amber-300 px-2 py-1 text-black">IMDb {Number(movie.ratingAvg || 0).toFixed(1)}</span><span className="rounded border border-white/20 px-2 py-1">{movie.quality || 'HD'}</span><span className="rounded border border-white/20 px-2 py-1">{movie.releaseYear}</span><span className="rounded border border-white/20 px-2 py-1">{movie.isSeries ? `Tập ${activeEpOrder}` : `${movie.duration || 0} phút`}</span></div>
        <div className="mt-3 flex flex-wrap gap-1.5">{movie.movieGenres?.slice(0, 4).map(({ genre }) => <Link key={genre.slug} href={`/the-loai/${genre.slug}`} className="rounded-full bg-white/5 px-2.5 py-1 text-[9px] text-slate-400 hover:text-white">{genre.name}</Link>)}</div>
      </div>
      <div className="text-xs leading-6 text-slate-400"><p className="line-clamp-4">{movie.description || 'Nội dung phim đang được cập nhật.'}</p><Link href={`/movies/${movie.slug}`} className="mt-2 inline-flex items-center gap-1 font-bold text-amber-300 hover:text-amber-200">Thông tin phim <Info className="h-3 w-3" /></Link></div>
    </section>

    {movie.episodes.length > 1 && <section className="py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3"><h2 className="flex items-center gap-2 text-base font-bold"><ListVideo className="h-5 w-5 text-amber-300" /> Phần {selectedSeason}<ChevronDown className="h-4 w-4 text-slate-500" /></h2>{seasons.length > 1 && <div className="flex gap-1">{seasons.map((season) => <button key={season} onClick={() => setSelectedSeason(season)} className={`rounded px-2.5 py-1 text-[10px] font-bold ${season === selectedSeason ? 'bg-amber-300 text-black' : 'bg-white/5 text-slate-400'}`}>Phần {season}</button>)}</div>}<label className="ml-auto flex items-center gap-2 rounded-md bg-[#242632] px-3 py-2"><Search className="h-3 w-3 text-slate-500" /><input value={episodeQuery} onChange={(event) => setEpisodeQuery(event.target.value)} placeholder="Tìm tập" className="w-16 bg-transparent text-[10px] outline-none" /></label></div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">{episodes.map((episode) => <Link key={episode.id} href={`/watch/${movie.slug}?ep=${episode.episodeOrder}`} className={`flex items-center justify-center gap-2 rounded-md px-3 py-3 text-[11px] font-semibold transition ${activeEpOrder === episode.episodeOrder ? 'bg-amber-300 text-black' : 'bg-[#282a38] text-slate-300 hover:bg-[#343746]'}`}><Play className="h-3 w-3 fill-current" />{episode.title}</Link>)}</div>
      {!episodes.length && <p className="py-8 text-center text-xs text-slate-500">Không tìm thấy tập phù hợp.</p>}
    </section>}
  </>;
}
