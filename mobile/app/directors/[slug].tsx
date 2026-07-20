import { useLocalSearchParams } from 'expo-router';
import { firstRouteParam } from '@/core/route-params';
import { PersonScreen } from '@/features/discovery/presentation/person-screen';

export default function DirectorRoute() {
  const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();
  return <PersonScreen kind="director" slug={firstRouteParam(slug)} />;
}
