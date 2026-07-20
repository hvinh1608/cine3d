import { useMemo } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Button, Text } from 'react-native-paper';
import { EmptyState, MovieCard, MovieRailSkeleton, Screen } from '@/components/ui';
import type { Movie } from '@/domain/models';
import { discoveryRepository } from '@/features/discovery/data/http-discovery-repository';
import { discoveryKeys, type MovieQuery } from '@/features/discovery/domain/discovery-repository';
import { useMovieGridLayout } from '@/core/responsive';
import { colors, spacing } from '@/theme';

type BrowseKind = 'genre' | 'country' | 'year';

export function BrowseScreen({ kind, value }: { kind: BrowseKind; value: string | number | null }) {
  const { gridColumns, cardWidth } = useMovieGridLayout(spacing.md, spacing.sm);
  const query = useMemo<Omit<MovieQuery, 'page'>>(() => ({
    limit: 24,
    ...(kind === 'genre' && typeof value === 'string' ? { genre: value } : {}),
    ...(kind === 'country' && typeof value === 'string' ? { country: value } : {}),
    ...(kind === 'year' && typeof value === 'number' ? { year: value } : {}),
    sortBy: 'updatedAt',
  }), [kind, value]);
  const movies = useInfiniteQuery({
    queryKey: discoveryKeys.movies({ ...query, page: 1 }),
    queryFn: ({ pageParam }) => discoveryRepository.getMovies({ ...query, page: pageParam }),
    initialPageParam: 1,
    enabled: value !== null,
    getNextPageParam: (last) => last.page < last.totalPages ? last.page + 1 : undefined,
  });
  const data = movies.data?.pages.flatMap((page) => page.movies) ?? [];
  const title = kind === 'genre' ? 'Thể loại' : kind === 'country' ? 'Quốc gia' : 'Năm phát hành';
  const displayValue = typeof value === 'string' ? value.replaceAll('-', ' ') : value;

  return (
    <Screen>
      <FlashList
        data={data}
        key={`grid-${gridColumns}`}
        numColumns={gridColumns}
        keyExtractor={(item) => item.id || item.slug}
        renderItem={({ item }: { item: Movie }) => <View style={styles.item}><MovieCard movie={item} width={cardWidth} /></View>}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="labelLarge" style={styles.eyebrow}>{title}</Text>
            <Text variant="headlineMedium" style={styles.title}>{displayValue ?? 'Liên kết không hợp lệ'}</Text>
          </View>
        }
        ListEmptyComponent={movies.isPending
          ? <MovieRailSkeleton />
          : movies.error
            ? <View style={styles.error}><EmptyState title="Không thể tải danh mục" message={movies.error.message} /><Button onPress={() => void movies.refetch()}>Thử lại</Button></View>
            : <EmptyState title="Chưa có phim" message="Danh mục này hiện chưa có nội dung." />}
        ListFooterComponent={movies.isFetchingNextPage ? <MovieRailSkeleton /> : <View style={styles.footer} />}
        refreshControl={<RefreshControl refreshing={movies.isRefetching && !movies.isFetchingNextPage} onRefresh={() => void movies.refetch()} tintColor={colors.primary} />}
        onEndReached={() => { if (movies.hasNextPage && !movies.isFetchingNextPage) void movies.fetchNextPage(); }}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.content}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  header: { padding: spacing.lg, gap: spacing.xs },
  eyebrow: { color: colors.primarySoft, textTransform: 'uppercase' },
  title: { fontWeight: '900', textTransform: 'capitalize' },
  item: { flex: 1, alignItems: 'center', paddingBottom: spacing.md },
  error: { minHeight: 320 },
  footer: { height: spacing.xl },
});
