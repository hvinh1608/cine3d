import { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Pressable } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';
import { EmptyState, MovieRailSkeleton, Screen } from '@/components/ui';
import { discoveryRepository } from '@/features/discovery/data/http-discovery-repository';
import { discoveryKeys, type ScheduleEntry } from '@/features/discovery/domain/discovery-repository';
import { colors, radius, spacing } from '@/theme';

export function ScheduleScreen() {
  const [segment, setSegment] = useState<'upcoming' | 'released'>('upcoming');
  const query = useQuery({
    queryKey: discoveryKeys.schedule(),
    queryFn: () => discoveryRepository.getSchedule(),
  });
  const entries = useMemo(
    () => (query.data ?? []).filter((entry) => segment === 'released' ? entry.isReleased : !entry.isReleased),
    [query.data, segment],
  );

  return (
    <Screen>
      <FlashList
        data={entries}
        keyExtractor={(entry) => entry.id}
        renderItem={({ item }: { item: ScheduleEntry }) => <ScheduleCard entry={item} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="headlineMedium" style={styles.title}>Lịch phát hành</Text>
            <Text style={styles.muted}>Theo dõi tập mới trong 30 ngày tới</Text>
            <SegmentedButtons
              value={segment}
              onValueChange={(value) => setSegment(value as typeof segment)}
              buttons={[{ value: 'upcoming', label: 'Sắp chiếu' }, { value: 'released', label: 'Đã phát hành' }]}
            />
          </View>
        }
        ListEmptyComponent={query.isPending
          ? <MovieRailSkeleton />
          : query.error
            ? <EmptyState title="Không thể tải lịch" message={`${query.error.message}. Hãy thử lại khi có mạng.`} />
            : <EmptyState title="Chưa có lịch chiếu" message="Không có tập phim trong khoảng thời gian này." />}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.primary} />}
        contentContainerStyle={styles.content}
      />
    </Screen>
  );
}

function ScheduleCard({ entry }: { entry: ScheduleEntry }) {
  const date = new Date(entry.airDate);
  const dateLabel = Number.isNaN(date.getTime())
    ? 'Chưa xác định'
    : new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
  return (
    <Link href={{ pathname: '/movies/[slug]', params: { slug: entry.movie.slug } }} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={`Mở ${entry.movie.title}`} style={styles.card}>
        <Image source={entry.movie.posterUrl} style={styles.poster} contentFit="cover" cachePolicy="memory-disk" />
        <View style={styles.body}>
          <Text variant="titleMedium" numberOfLines={2}>{entry.movie.title}</Text>
          <Text style={styles.muted} numberOfLines={1}>{entry.title || `Tập ${entry.episodeOrder}`}</Text>
          <Text style={entry.isReleased ? styles.released : styles.upcoming}>{dateLabel}</Text>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  header: { gap: spacing.sm, marginBottom: spacing.lg },
  title: { fontWeight: '900' },
  muted: { color: colors.textMuted },
  card: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface },
  poster: { width: 72, height: 106, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised },
  body: { flex: 1, justifyContent: 'center', gap: spacing.sm },
  released: { color: colors.success },
  upcoming: { color: colors.warning },
});
