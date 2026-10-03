import api from './api';
import { movieImageUrl } from './movie-image';

const prefetched = new Set<string>();

function warmImage(url?: string | null, width = 640) {
  if (!url || typeof window === 'undefined') return;
  try {
    const img = new window.Image();
    img.decoding = 'async';
    img.src = movieImageUrl(url, width, 70);
  } catch {
    // Ignore warm failures — detail page still loads normally.
  }
}

/** Warm movie detail API + poster/backdrop before the user clicks. */
export function prefetchMovieDetail(slug?: string | null) {
  const key = String(slug || '').trim();
  if (!key || prefetched.has(key)) return;
  prefetched.add(key);
  void api.get(`/movies/${encodeURIComponent(key)}`, { timeout: 45_000 }).then((response) => {
    const movie = response.data;
    warmImage(movie?.posterUrl, 480);
    warmImage(movie?.backdropUrl, 1600);
  }).catch(() => {
    prefetched.delete(key);
  });
}
