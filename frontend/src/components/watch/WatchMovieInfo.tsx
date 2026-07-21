'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Info, Users, Share2, LightbulbOff, PictureInPicture2, Crown, Wifi, Flag, Star, ListVideo, Search } from 'lucide-react';
import type { Episode, Movie, VideoSource } from '../../types/movie';

type PlaybackEpisode = Episode & { premiumSourcesLocked?: number };
type PlaybackMovie = Movie & { requiresVip?: boolean; isEarlyAccess?: boolean; episodes: PlaybackEpisode[] };

interface WatchMovieInfoProps {
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

export default function WatchMovieInfo({
  movie,
  activeEpisode,
  activeEpOrder,
  user,
  lightsOff,
  dataSaver,
  onToggleLights,
  onToggleDataSaver,
  onPictureInPicture,
  onReportPlayback,
  onCopyLink,
}: WatchMovieInfoProps) {
  const [episodeQuery, setEpisodeQuery] = useState('');
  const [selectedSeason, setSelectedSeason] = useState(activeEpisode?.seasonNumber || 1);

  const seasonNumbers = Array.from(new Set((movie.episodes || []).map((ep) => ep.seasonNumber || 1))).sort((a, b) => a - b);
  const visibleEpisodes = (movie.episodes || []).filter((ep) => {
    const matchesSeason = (ep.seasonNumber || 1) === selectedSeason;
    const query = episodeQuery.trim().toLocaleLowerCase('vi');
    return matchesSeason && (!query || ep.title.toLocaleLowerCase('vi').includes(query) || String(ep.episodeOrder) === query);
  });

  return (
    <>
      {/* Quick actions under the player */}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-slate-950/70 p-2.5 text-[11px] font-bold text-slate-400 shadow-lg backdrop-blur">
        <Link href={`/movies/${movie.slug}`} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 transition hover:bg-white/5 hover:text-white"><Info className="h-3.5 w-3.5" /> Thông tin phim</Link>
        <Link href={`/watch-together?slug=${encodeURIComponent(movie.slug)}&ep=${activeEpisode.episodeOrder}`} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 transition hover:bg-white/5 hover:text-red-300"><Users className="h-3.5 w-3.5" /> Xem chung</Link>
        <button type="button" onClick={onCopyLink} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 transition hover:bg-white/5 hover:text-white"><Share2 className="h-3.5 w-3.5" /> Chia sẻ</button>
        <button type="button" onClick={onToggleLights} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 transition hover:bg-white/5 ${lightsOff ? 'text-red-400' : 'hover:text-white'}`}><LightbulbOff className="h-3.5 w-3.5" /> Tắt đèn</button>
        <button type="button" onClick={onPictureInPicture} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 transition hover:bg-white/5 ${user?.isVip ? 'text-amber-300 hover:text-amber-200' : 'hover:text-white'}`}><PictureInPicture2 className="h-3.5 w-3.5" /> Cửa sổ nổi <Crown className="h-3 w-3 text-amber-400" /></button>
        <button type="button" onClick={onToggleDataSaver} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 transition hover:bg-white/5 ${dataSaver ? 'text-emerald-300' : 'hover:text-white'}`}><Wifi className="h-3.5 w-3.5" /> Tiết kiệm data {dataSaver ? 'Bật' : 'Tắt'}</button>
        <button type="button" onClick={onReportPlayback} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 transition hover:bg-red-500/10 hover:text-red-300"><Flag className="h-3.5 w-3.5" /> Báo lỗi</button>
        <div className="ml-auto hidden items-center gap-2 px-2 text-slate-600 sm:flex"><span>← → tua 10 giây</span><span>•</span><span>Nhấp đúp để tua</span></div>
      </div>

      {/* Movie summary */}
      <section className="mt-4 overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-slate-900/95 to-slate-950/95 p-4 shadow-xl md:p-5">
        <div className="flex gap-4 md:gap-5">
          <Image src={movie.posterUrl} alt={movie.title} width={112} height={160} className="h-32 w-[88px] shrink-0 rounded-xl object-cover shadow-2xl md:h-40 md:w-28" />
          <div className="min-w-0 flex-1 text-left">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400">Bạn đang xem</p><h1 className="mt-1 text-xl font-black text-white md:text-2xl">{movie.title}</h1>{movie.englishTitle && <p className="mt-0.5 text-xs text-slate-500">{movie.englishTitle}</p>}</div>
              <div className="flex items-center gap-1 rounded-lg border border-amber-400/20 bg-amber-400/10 px-2.5 py-1.5 text-xs font-black text-amber-300"><Star className="h-3.5 w-3.5 fill-current" /> {Number(movie.ratingAvg || 0).toFixed(1)}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-bold"><span className="rounded-md bg-red-600 px-2 py-1 text-white">{movie.quality || 'HD'}</span><span className="rounded-md bg-white/5 px-2 py-1 text-slate-300">{movie.releaseYear}</span><span className="rounded-md bg-white/5 px-2 py-1 text-slate-300">{movie.isSeries ? `${movie.episodeCount} tập` : `${movie.duration || 0} phút`}</span>{movie.movieGenres?.slice(0, 3).map((item) => <span key={item.genre.slug} className="rounded-md bg-white/5 px-2 py-1 text-slate-400">{item.genre.name}</span>)}</div>
            <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-400 md:text-sm md:leading-6">{movie.description || 'Thông tin nội dung đang được cập nhật.'}</p>
          </div>
        </div>
      </section>

      {/* Episode grid */}
      {movie.episodes.length > 1 && (
        <section className="mt-4 rounded-2xl border border-white/5 bg-slate-950/70 p-4 text-left shadow-xl md:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white"><ListVideo className="h-4 w-4 text-amber-400" /> Danh sách tập</h2><label className="flex items-center gap-2 rounded-lg border border-white/5 bg-slate-900 px-3 py-2"><Search className="h-3.5 w-3.5 text-slate-600" /><input value={episodeQuery} onChange={(event) => setEpisodeQuery(event.target.value)} placeholder="Tìm số tập..." className="w-24 bg-transparent text-xs text-white outline-none placeholder:text-slate-600" /></label></div>
          {seasonNumbers.length > 1 && <div className="mb-3 flex flex-wrap gap-2">{seasonNumbers.map((season) => <button key={season} type="button" onClick={() => setSelectedSeason(season)} className={`rounded-lg px-3 py-1.5 text-[10px] font-black ${selectedSeason === season ? 'bg-purple-500 text-white' : 'bg-white/5 text-slate-500 hover:text-white'}`}>Phần {season}</button>)}</div>}
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 xl:grid-cols-10">{visibleEpisodes.map((episode) => <Link key={episode.id} href={`/watch/${movie.slug}?ep=${episode.episodeOrder}`} className={`rounded-lg border px-2 py-2.5 text-center text-[11px] font-bold transition ${activeEpOrder === episode.episodeOrder ? 'border-amber-400 bg-amber-400 text-slate-950 shadow-[0_0_18px_rgba(251,191,36,0.15)]' : 'border-white/5 bg-slate-900 text-slate-400 hover:border-white/15 hover:bg-slate-800 hover:text-white'}`}>{episode.title}</Link>)}</div>
          {!visibleEpisodes.length && <p className="py-6 text-center text-xs text-slate-600">Không tìm thấy tập phù hợp.</p>}
        </section>
      )}
    </>
  );
}
