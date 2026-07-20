import { useLocalSearchParams } from 'expo-router';
import { firstRouteParam } from '@/core/route-params';
import { NativePlayerScreen } from '@/features/player/presentation/native-player-screen';

export default function WatchRoute() {
  const params = useLocalSearchParams<{ slug?: string | string[]; ep?: string | string[] }>();
  const slug = firstRouteParam(params.slug) ?? '';
  const episode = Number(firstRouteParam(params.ep));
  return <NativePlayerScreen slug={slug} episodeNumber={Number.isFinite(episode) && episode > 0 ? episode : undefined} />;
}
