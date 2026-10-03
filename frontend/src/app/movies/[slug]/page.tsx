import MovieDetailClient from '@/components/movies/MovieDetailClient';
import { fetchMovieBySlug, fetchRelatedMovies } from '@/lib/movie-detail-server';

type Params = Promise<{ slug: string }>;

export default async function MovieDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const movie = await fetchMovieBySlug(slug);
  const related = movie ? await fetchRelatedMovies(movie) : [];

  return (
    <MovieDetailClient
      slug={slug}
      initialData={{
        movie,
        related,
        loadError: movie ? undefined : 'Không tìm thấy phim hoặc tạm thời chưa xem được. Vui lòng thử lại.',
      }}
    />
  );
}
