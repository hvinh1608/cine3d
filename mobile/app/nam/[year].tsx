import { useLocalSearchParams } from 'expo-router';
import { yearRouteParam } from '@/core/route-params';
import { BrowseScreen } from '@/features/discovery/presentation/browse-screen';

export default function YearRoute() {
  const { year } = useLocalSearchParams<{ year?: string | string[] }>();
  return <BrowseScreen kind="year" value={yearRouteParam(year)} />;
}
