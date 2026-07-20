import { useLocalSearchParams } from 'expo-router';
import { EmptyState, Screen } from '@/components/ui';
import { firstRouteParam } from '@/core/route-params';
import { MovieDetailScreen } from '@/features/movies/presentation/movie-detail-screen';

export default function MovieRoute() {
  const { slug: rawSlug } = useLocalSearchParams<{ slug?: string | string[] }>();
  const slug = firstRouteParam(rawSlug);
  if (!slug) return <Screen><EmptyState title="Liên kết không hợp lệ" message="Không tìm thấy mã phim trong liên kết này." /></Screen>;
  return <MovieDetailScreen slug={slug} />;
}
