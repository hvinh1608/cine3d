import { useLocalSearchParams } from 'expo-router';
import { firstRouteParam } from '@/core/route-params';
import { BrowseScreen } from '@/features/discovery/presentation/browse-screen';

export default function GenreRoute() {
  const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();
  return <BrowseScreen kind="genre" value={firstRouteParam(slug)} />;
}
