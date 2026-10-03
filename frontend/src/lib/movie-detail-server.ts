import { cache } from 'react';
import type { Movie } from '@/types/movie';

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export type MovieDetail = Movie & {
  country?: { name: string };
  movieGenres?: { genre: { name: string; slug: string } }[];
  movieActors?: { actor: { name: string; slug?: string; avatarUrl?: string | null } }[];
  movieDirectors?: { director: { name: string; slug?: string; avatarUrl?: string | null } }[];
};

/** Deduped within one RSC request (layout metadata + page share one API call). */
export const fetchMovieBySlug = cache(async (slug: string): Promise<MovieDetail | null> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 40_000);
  try {
    const response = await fetch(`${API_URL}/movies/${encodeURIComponent(slug)}`, {
      next: { revalidate: 120 },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as MovieDetail;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
});

export async function fetchRelatedMovies(movie: MovieDetail): Promise<Movie[]> {
  const genre = movie.movieGenres?.[0]?.genre.slug;
  if (!genre) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const params = new URLSearchParams({ genre, limit: '10' });
    const response = await fetch(`${API_URL}/movies?${params}`, {
      next: { revalidate: 300 },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const data = await response.json();
    const movies = Array.isArray(data.movies) ? data.movies : [];
    return movies
      .filter((item: Movie) => item.id !== movie.id && item.slug !== movie.slug)
      .slice(0, 6);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
