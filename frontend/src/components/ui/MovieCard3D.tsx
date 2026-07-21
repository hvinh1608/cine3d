'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from '@/components/ui/ResilientImage';
import { CircleAlert, Heart, Play, Star, Plus, Check } from 'lucide-react';
import { useStore } from '../../hooks/useStore';
import type { Movie } from '../../types/movie';

interface Props {
  movie: Movie;
  onToggleFavorite?: (movieId: string, movie?: Movie) => void;
  isFavorited?: boolean;
  slant?: 'left' | 'right';
}

export default function MovieCard3D({ movie, onToggleFavorite, isFavorited = false, slant }: Props) {
  const { reduceMotion } = useStore();
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 });
  const [hovered, setHovered] = useState(false);
  const [previewAnchor, setPreviewAnchor] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  
  const cardRef = useRef<HTMLDivElement>(null);

  const clearPreviewTimers = () => {
    if (openTimerRef.current !== null) window.clearTimeout(openTimerRef.current);
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    openTimerRef.current = null;
    closeTimerRef.current = null;
  };

  const keepPreviewOpen = () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  };

  const schedulePreviewClose = () => {
    if (openTimerRef.current !== null) window.clearTimeout(openTimerRef.current);
    openTimerRef.current = null;
    closeTimerRef.current = window.setTimeout(() => setPreviewAnchor(null), 180);
  };

  useEffect(() => {
    if (!previewAnchor) return;
    const closePreview = () => setPreviewAnchor(null);
    window.addEventListener('scroll', closePreview, true);
    window.addEventListener('resize', closePreview);
    return () => {
      window.removeEventListener('scroll', closePreview, true);
      window.removeEventListener('resize', closePreview);
    };
  }, [previewAnchor]);

  useEffect(() => () => clearPreviewTimers(), []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduceMotion || !cardRef.current) return;
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    
    // Mouse coords inside the card
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const width = rect.width;
    const height = rect.height;

    // Calculate rotation limits (-15 to 15 deg)
    const rotX = -((y - height / 2) / (height / 2)) * 12;
    const rotY = ((x - width / 2) / (width / 2)) * 12;

    setRotateX(rotX);
    setRotateY(rotY);

    // Glare position percentage
    const glareX = (x / width) * 100;
    const glareY = (y / height) * 100;
    setGlarePos({ x: glareX, y: glareY });
  };

  const handleMouseEnter = () => {
    setHovered(true);
    keepPreviewOpen();
    if (reduceMotion || !window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1024px)').matches) return;
    openTimerRef.current = window.setTimeout(() => {
      const rect = cardRef.current?.getBoundingClientRect();
      if (rect) setPreviewAnchor({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    }, 550);
  };

  const handleMouseLeave = () => {
    setHovered(false);
    setRotateX(0);
    setRotateY(0);
    schedulePreviewClose();
  };

  // Card transform styles
  const cardStyle: React.CSSProperties = {
    ...(slant ? {
      clipPath: slant === 'left'
        ? 'polygon(0 0, 100% 6%, 100% 100%, 0 100%)'
        : 'polygon(0 6%, 100% 0, 100% 100%, 0 100%)',
    } : {}),
    ...(!reduceMotion ? {
        transform: hovered
          ? `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`
          : 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
        transition: hovered ? 'none' : 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
        transformStyle: 'preserve-3d',
      } : {}),
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={cardStyle}
      className="group relative aspect-[2/3] w-full cursor-pointer overflow-hidden rounded-2xl border-[3px] border-white/10 bg-slate-900 shadow-2xl transition-[border-color,box-shadow] duration-300 hover:border-amber-300 hover:shadow-[0_0_0_1px_rgba(252,211,77,.3),0_0_24px_rgba(245,158,11,.28)]"
    >
      {/* Glare effect */}
      {hovered && !reduceMotion && (
        <div
          style={{
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 60%)`,
          }}
          className="absolute inset-0 z-30 pointer-events-none mix-blend-overlay"
        />
      )}

      {/* Clicking either image opens the movie page. */}
      <Link href={`/movies/${movie.slug}`} className="absolute inset-0 z-0">
        <Image
          src={movie.posterUrl}
          alt={movie.title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 220px"
          className={`absolute inset-0 h-full w-full object-cover transition-transform duration-700 ${
            hovered && !reduceMotion ? 'scale-105 opacity-20' : 'scale-100 opacity-100'
          }`}
        />

        {/* Load the backdrop only after hover to avoid downloading hidden images. */}
        {hovered && movie.backdropUrl && (
          <Image
            src={movie.backdropUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 220px"
            className="absolute inset-0 z-10 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-80"
          />
        )}
      </Link>

      {/* Glassmorphism details overlay (pops out on Z axis) */}
      <div
        style={{
          transform: hovered && !reduceMotion ? 'translateZ(35px)' : 'translateZ(0px)',
          transition: 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
        }}
        className="absolute inset-0 z-20 flex flex-col justify-end p-4 bg-gradient-to-t from-black via-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
      >
        <span className="absolute top-3 left-3 bg-red-600/90 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded shadow-lg backdrop-blur-sm">
          {movie.quality}
        </span>

        {movie.isSeries && (
          <span className="absolute top-3 right-3 bg-purple-600/90 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded shadow-lg backdrop-blur-sm">
            {movie.episodeCount} Tập
          </span>
        )}

        <div className="space-y-1.5 text-left">
          <h3 className="text-white font-bold text-base leading-tight tracking-wide drop-shadow-md">
            {movie.title}
          </h3>
          {movie.englishTitle && (
            <p className="text-slate-400 text-xs truncate drop-shadow-sm">
              {movie.englishTitle}
            </p>
          )}

          <div className="flex items-center space-x-3 text-[11px] text-slate-300 font-medium">
            <span className="flex items-center text-yellow-400">
              <Star className="w-3.5 h-3.5 fill-current mr-0.5" />
              {movie.ratingAvg.toFixed(1)}
            </span>
            <span>{movie.releaseYear}</span>
            <span>{movie.isSeries ? 'Phim Bộ' : 'Phim Lẻ'}</span>
          </div>

          <div className="flex items-center justify-between pt-2 pointer-events-auto">
            {/* Play Button */}
            <Link
              href={`/movies/${movie.slug}`}
              className="flex items-center justify-center bg-white text-black text-xs font-bold px-4 py-2 rounded-full hover:bg-red-600 hover:text-white transition-all shadow-md active:scale-95 flex-1 mr-2"
            >
              <Play className="w-3.5 h-3.5 fill-current mr-1" /> Chi Tiết
            </Link>

            {/* Favorite Add Toggle */}
            {onToggleFavorite && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onToggleFavorite(movie.id, movie);
                }}
                className="flex items-center justify-center w-8 h-8 rounded-full border border-white/20 bg-black/40 hover:bg-white/20 text-white transition-all active:scale-90"
              >
                {isFavorited ? <Check className="w-4 h-4 text-green-400" /> : <Plus className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {previewAnchor && createPortal(
        <MovieHoverPreview
          movie={movie}
          anchor={previewAnchor}
          isFavorited={isFavorited}
          onToggleFavorite={onToggleFavorite}
          onMouseEnter={keepPreviewOpen}
          onMouseLeave={schedulePreviewClose}
        />,
        document.body,
      )}
    </div>
  );
}

function MovieHoverPreview({
  movie,
  anchor,
  isFavorited,
  onToggleFavorite,
  onMouseEnter,
  onMouseLeave,
}: {
  movie: Movie;
  anchor: { left: number; top: number; width: number; height: number };
  isFavorited: boolean;
  onToggleFavorite?: Props['onToggleFavorite'];
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const width = Math.min(460, window.innerWidth - 24);
  const estimatedHeight = Math.min(465, window.innerHeight - 24);
  const left = Math.min(Math.max(12, anchor.left + anchor.width / 2 - width / 2), window.innerWidth - width - 12);
  const top = Math.min(Math.max(12, anchor.top + anchor.height / 2 - estimatedHeight / 2), window.innerHeight - estimatedHeight - 12);
  const genres = movie.movieGenres?.slice(0, 3).map(({ genre }) => genre.name) || [];

  return (
    <article
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ left, top, width }}
      className="fixed z-[100] hidden max-h-[calc(100vh-24px)] overflow-hidden rounded-2xl border border-white/10 bg-[#2a2d3d] text-left text-white opacity-100 shadow-[0_28px_90px_rgba(0,0,0,0.7)] transition duration-200 starting:scale-95 starting:opacity-0 lg:block"
    >
      <Link href={`/movies/${movie.slug}`} className="relative block aspect-[16/9] w-full overflow-hidden bg-slate-900">
        <Image src={movie.backdropUrl || movie.posterUrl} alt={movie.title} fill sizes="460px" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#2a2d3d] via-transparent to-black/10" />
      </Link>

      <div className="relative z-10 -mt-10 space-y-3 px-5 pb-5 pt-3">
        <div>
          <h3 className="text-xl font-black leading-tight drop-shadow-lg">{movie.title}</h3>
          {movie.englishTitle && <p className="mt-1 text-sm font-medium text-amber-300">{movie.englishTitle}</p>}
        </div>

        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <Link href={`/movies/${movie.slug}`} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-200 to-amber-400 px-4 text-sm font-black text-[#171923] transition hover:brightness-110">
            <Play className="h-4 w-4 fill-current" /> Xem ngay
          </Link>
          {onToggleFavorite && (
            <button type="button" onClick={() => onToggleFavorite(movie.id, movie)} className="flex h-12 items-center gap-1.5 rounded-xl border border-white/40 px-3.5 text-sm font-bold transition hover:bg-white/10">
              {isFavorited ? <Check className="h-4 w-4 text-emerald-400" /> : <Heart className="h-4 w-4 fill-white" />} Thích
            </button>
          )}
          <Link href={`/movies/${movie.slug}`} className="flex h-12 items-center gap-1.5 rounded-xl border border-white/40 px-3.5 text-sm font-bold transition hover:bg-white/10">
            <CircleAlert className="h-4 w-4 fill-white text-[#2a2d3d]" /> Chi tiết
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-md border border-yellow-400 px-2 py-1 text-xs"><b className="text-yellow-300">IMDb</b> {movie.ratingAvg?.toFixed(1) || '8.0'}</span>
          <span className="rounded-md bg-white px-2.5 py-1 text-black">T16</span>
          <span className="rounded-md bg-white/10 px-2.5 py-1">{movie.releaseYear}</span>
          <span className="rounded-md bg-white/10 px-2.5 py-1">{movie.isSeries ? 'Phần 1' : 'Movie'}</span>
          <span className="rounded-md bg-white/10 px-2.5 py-1">{movie.isSeries ? `Tập ${movie.episodeCount}` : 'Full'}</span>
        </div>

        {genres.length > 0 && <p className="flex flex-wrap gap-2 text-xs text-slate-200">{genres.map((genre, index) => <React.Fragment key={genre}>{index > 0 && <span className="text-slate-500">•</span>}<span>{genre}</span></React.Fragment>)}</p>}
      </div>
    </article>
  );
}
