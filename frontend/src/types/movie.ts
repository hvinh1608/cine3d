export interface VideoSource { id: string; server: string; quality: string; url: string; type: 'hls' | 'mp4' }
export interface Episode { id: string; title: string; episodeOrder: number; videoSources: VideoSource[] }
export interface Movie {
  id: string; title: string; englishTitle?: string | null; slug: string;
  description?: string; posterUrl: string; backdropUrl: string; trailerUrl?: string | null;
  releaseYear: number; duration?: number; quality: string; ratingAvg: number; views?: number;
  isSeries: boolean; episodeCount: number; episodes?: Episode[];
  movieGenres?: { genre: { name: string; slug: string } }[];
  movieActors?: { actor: { name: string } }[];
  movieDirectors?: { director: { name: string } }[];
}
export interface Banner { id: string; title: string; description: string; imageUrl: string; movie: Movie }
export interface MetaItem { name: string; slug: string }
export interface PaginatedMovies { movies: Movie[]; total: number; page: number; limit: number; totalPages: number }
