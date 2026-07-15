'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Play, Star, Plus, Check } from 'lucide-react';
import type { Movie } from '../../types/movie';

interface Props {
  movie: Movie;
  onToggleFavorite?: (movieId: string, movie?: Movie) => void;
  isFavorited?: boolean;
}

export default function MovieCardLandscape({ movie, onToggleFavorite, isFavorited = false }: Props) {
  const [hovered, setHovered] = useState(false);

  const displayImage = movie.backdropUrl || movie.posterUrl;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative aspect-video w-full rounded-xl overflow-hidden cursor-pointer bg-slate-900 border border-white/5 shadow-lg group select-none"
    >
      {/* Clicking the image opens the movie details page. */}
      <Link href={`/movies/${movie.slug}`} className="absolute inset-0 z-0">
        <Image
          src={displayImage}
          alt={movie.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 350px"
          className={`absolute inset-0 h-full w-full object-cover transition-transform duration-500 ${
            hovered ? 'scale-105' : 'scale-100'
          }`}
        />
      </Link>

      {/* Shadows/Gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

      {/* Badges in corner */}
      <div className="absolute top-2 left-2 z-20 flex flex-col gap-1">
        <span className="bg-red-600/90 text-[9px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded shadow-md backdrop-blur-sm text-white">
          {movie.quality}
        </span>
      </div>

      {movie.isSeries && (
        <div className="absolute top-2 right-2 z-20">
          <span className="bg-cyan-600/90 text-[9px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded shadow-md backdrop-blur-sm text-white">
            {movie.episodeCount} Tập
          </span>
        </div>
      )}

      {/* Overlay details */}
      <div className="absolute inset-0 z-10 flex flex-col justify-end p-3 text-left pointer-events-none">
        <h3 className="text-white font-bold text-sm md:text-base leading-tight tracking-wide truncate group-hover:text-red-400 transition-colors">
          {movie.title}
        </h3>
        
        {/* Hover elements: Play/Favorite and details */}
        <div className={`flex items-center justify-between mt-1 transition-all duration-300 ${
          hovered ? 'opacity-100 max-h-12 translate-y-0' : 'opacity-0 max-h-0 translate-y-2 overflow-hidden'
        }`}>
          <div className="flex items-center space-x-2 text-[10px] text-slate-300 font-semibold">
            <span className="flex items-center text-yellow-400">
              <Star className="w-3 h-3 fill-current mr-0.5" />
              {movie.ratingAvg.toFixed(1)}
            </span>
            <span>•</span>
            <span>{movie.releaseYear}</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <Link
              href={`/movies/${movie.slug}`}
              className="flex items-center justify-center bg-white text-black rounded-full p-1 hover:bg-red-600 hover:text-white transition-colors pointer-events-auto"
              title="Xem Chi Tiết"
            >
              <Play className="w-3 h-3 fill-current" />
            </Link>

            {onToggleFavorite && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onToggleFavorite(movie.id, movie);
                }}
                className="flex items-center justify-center p-1 rounded-full border border-white/20 bg-black/40 hover:bg-white/20 text-white transition-all pointer-events-auto"
                title="Yêu Thích"
              >
                {isFavorited ? <Check className="w-3 h-3 text-green-400" /> : <Plus className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>

        {/* Static metadata when NOT hovered */}
        <div className={`flex items-center space-x-2 text-[9px] text-slate-400 font-medium transition-opacity duration-300 ${
          hovered ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'
        }`}>
          <span>{movie.releaseYear}</span>
          <span>•</span>
          <span>{movie.isSeries ? 'Phim Bộ' : 'Phim Lẻ'}</span>
        </div>
      </div>
    </div>
  );
}
