'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Play, Star, Plus, Check } from 'lucide-react';
import { useStore } from '../../hooks/useStore';
import type { Movie } from '../../types/movie';

interface Props {
  movie: Movie;
  onToggleFavorite?: (movieId: string, movie?: Movie) => void;
  isFavorited?: boolean;
}

export default function MovieCard3D({ movie, onToggleFavorite, isFavorited = false }: Props) {
  const { reduceMotion } = useStore();
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 });
  const [hovered, setHovered] = useState(false);
  
  const cardRef = useRef<HTMLDivElement>(null);

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
  };

  const handleMouseLeave = () => {
    setHovered(false);
    setRotateX(0);
    setRotateY(0);
  };

  // Card transform styles
  const cardStyle: React.CSSProperties = reduceMotion
    ? {}
    : {
        transform: hovered
          ? `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`
          : 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
        transition: hovered ? 'none' : 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
        transformStyle: 'preserve-3d',
      };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={cardStyle}
      className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden cursor-pointer bg-slate-900 border border-white/10 shadow-2xl transition-shadow duration-500 hover:shadow-[0_0_25px_rgba(157,0,255,0.4)] group"
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
    </div>
  );
}
