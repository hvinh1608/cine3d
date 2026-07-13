'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import MovieCard3D from './MovieCard3D';
import type { Movie } from '../../types/movie';

interface Props {
  movies: Movie[];
  onToggleFavorite?: (movieId: string, movie?: Movie) => void;
  favorites?: string[];
}

export default function MovieCarousel3D({ movies, onToggleFavorite, favorites = [] }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!movies || movies.length === 0) return null;

  const handlePrev = () => {
    setActiveIndex((prev) => (prev === 0 ? movies.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev === movies.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="relative w-full py-8 overflow-hidden flex flex-col items-center">
      {/* 3D Perspective container */}
      <div
        className="relative w-full max-w-[1000px] h-[360px] md:h-[450px] flex items-center justify-center"
        style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}
      >
        {movies.map((movie, index) => {
          // Calculate offset relative to active card
          let offset = index - activeIndex;

          // Handle wrap-around math for smooth circular slider
          if (offset < -1 && activeIndex === movies.length - 1) {
            offset = 1;
          }
          if (offset > 1 && activeIndex === 0) {
            offset = -1;
          }

          // Render only center and adjacent cards for performance and design neatness
          const isVisible = Math.abs(offset) <= 1;

          if (!isVisible) return null;

          // Define inline 3D styles based on item position
          let style: React.CSSProperties = {
            position: 'absolute',
            width: '240px',
            height: '360px',
            zIndex: 10 - Math.abs(offset),
            opacity: offset === 0 ? 1 : 0.6,
            transition: 'all 0.6s cubic-bezier(0.25, 1, 0.5, 1)',
            pointerEvents: offset === 0 ? 'auto' : 'none',
          };

          if (offset === 0) {
            // Center active card
            style.transform = 'translateX(0) translateZ(50px) rotateY(0deg) scale(1.1)';
          } else if (offset === 1) {
            // Right card rotated and depth-pushed
            style.transform = 'translateX(180px) translateZ(-100px) rotateY(-20deg) scale(0.9)';
          } else if (offset === -1) {
            // Left card rotated and depth-pushed
            style.transform = 'translateX(-180px) translateZ(-100px) rotateY(20deg) scale(0.9)';
          }

          return (
            <div
              key={movie.id}
              style={style}
              className="md:w-[280px] md:h-[420px]"
            >
              <MovieCard3D
                movie={movie}
                onToggleFavorite={onToggleFavorite}
                isFavorited={favorites.includes(movie.id)}
              />
            </div>
          );
        })}

        {/* Carousel Controls */}
        <button
          onClick={handlePrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-40 bg-black/60 border border-white/10 hover:bg-white text-white hover:text-black p-3 rounded-full shadow-2xl transition-all active:scale-90"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <button
          onClick={handleNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-40 bg-black/60 border border-white/10 hover:bg-white text-white hover:text-black p-3 rounded-full shadow-2xl transition-all active:scale-90"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Slide Indicators */}
      <div className="flex space-x-1.5 mt-6">
        {movies.map((_, index) => (
          <button
            key={index}
            onClick={() => setActiveIndex(index)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              activeIndex === index ? 'w-6 bg-red-600' : 'w-2 bg-slate-700 hover:bg-slate-500'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
