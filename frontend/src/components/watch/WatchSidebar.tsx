'use client';

import React from 'react';
import Link from 'next/link';
import { Server, Crown, Lock } from 'lucide-react';
import type { Episode, Movie, VideoSource } from '../../types/movie';

type PlaybackEpisode = Episode & { premiumSourcesLocked?: number };
type PlaybackMovie = Movie & { requiresVip?: boolean; isEarlyAccess?: boolean; episodes: PlaybackEpisode[] };

interface WatchSidebarProps {
  movie: PlaybackMovie;
  activeEpisode: PlaybackEpisode;
  activeSource: VideoSource | null;
  user: { isVip?: boolean } | null;
  onSourceChange: (source: VideoSource) => void;
}

export default function WatchSidebar({ movie, activeEpisode, activeSource, user, onSourceChange }: WatchSidebarProps) {
  return (
    <div className="lg:col-span-1 flex flex-col space-y-6 text-left">
      {/* Server Select */}
      <div className="glass-panel p-4 md:p-5 rounded-2xl space-y-3">
        <h4 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center">
          <Server className="w-4.5 h-4.5 text-cyan-400 mr-2" /> Chọn Server Phát
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2">
          {movie.requiresVip ? (
            <p className="text-amber-400 text-xs font-bold py-2">Nguồn phát bị khóa (Yêu cầu VIP)</p>
          ) : (
            activeEpisode.videoSources?.map((source) => (
              <button
                key={source.id}
                onClick={() => onSourceChange(source)}
                className={`w-full py-2.5 px-4 text-xs font-bold rounded-lg border text-left transition-all cursor-pointer ${
                  activeSource?.id === source.id
                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                    : 'bg-slate-900 border-white/5 text-slate-400 hover:bg-white/5'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span>{source.server} ({source.quality})</span>
                  {source.isPremium && <span className="inline-flex items-center gap-1 rounded bg-amber-400/15 px-1.5 py-0.5 text-[8px] uppercase text-amber-300"><Crown className="h-2.5 w-2.5" /> VIP</span>}
                </span>
              </button>
            )) || <p className="text-slate-500 text-xs">Đang tải server...</p>
          )}
          {!movie.requiresVip && (activeEpisode.premiumSourcesLocked || 0) > 0 && !user?.isVip && (
            <Link href="/vip" className="col-span-full flex items-center justify-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2.5 text-xs font-bold text-amber-300 hover:bg-amber-400/10">
              <Lock className="h-3.5 w-3.5" /> Mở khóa {activeEpisode.premiumSourcesLocked} nguồn Premium/4K
            </Link>
          )}
        </div>
      </div>

      {!!movie.movieActors?.length && (
        <div className="glass-panel rounded-2xl p-4 md:p-5">
          <h4 className="mb-4 text-sm font-black uppercase tracking-wider text-slate-300">Diễn viên</h4>
          <div className="grid grid-cols-3 gap-4">
            {movie.movieActors.slice(0, 9).map(({ actor }) => (
              <div key={actor.name} className="min-w-0 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-slate-700 to-slate-900 text-sm font-black text-slate-300">{actor.name.slice(0, 1).toUpperCase()}</div>
                <p className="mt-1.5 truncate text-[9px] font-semibold text-slate-500">{actor.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
