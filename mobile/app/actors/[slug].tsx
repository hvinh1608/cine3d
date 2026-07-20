import { useLocalSearchParams } from 'expo-router';
import { firstRouteParam } from '@/core/route-params';
import { PersonScreen } from '@/features/discovery/presentation/person-screen';

export default function ActorRoute() {
  const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();
  return <PersonScreen kind="actor" slug={firstRouteParam(slug)} />;
}
