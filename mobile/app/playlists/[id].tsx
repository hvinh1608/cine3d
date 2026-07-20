import { useLocalSearchParams } from 'expo-router';
import { EmptyState, Screen } from '@/components/ui';
import { firstRouteParam } from '@/core/route-params';
import { PlaylistDetailScreen } from '@/features/movies/presentation/playlist-detail-screen';

export default function PlaylistRoute() {
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = firstRouteParam(rawId);
  if (!id) return <Screen><EmptyState title="Liên kết không hợp lệ" message="Không tìm thấy playlist trong liên kết này." /></Screen>;
  return <PlaylistDetailScreen id={id} />;
}
