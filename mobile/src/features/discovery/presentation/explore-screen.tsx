import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Funnel, Grid2X2, List, Search, X } from 'lucide-react-native';
import { Button, Chip, Divider, Modal, Portal, Searchbar, SegmentedButtons, Text } from 'react-native-paper';
import { EmptyState, MovieCard, MovieRailSkeleton, Screen } from '@/components/ui';
import { cacheRepository } from '@/data/cache/sqlite-cache';
import type { Movie } from '@/domain/models';
import { discoveryRepository } from '@/features/discovery/data/http-discovery-repository';
import {
  discoveryKeys,
  type MovieQuery,
  type MovieSort,
  type MovieType,
} from '@/features/discovery/domain/discovery-repository';
import { colors, radius, spacing } from '@/theme';
import { useMovieGridLayout } from '@/core/responsive';
import { PaginationControls } from '@/components/pagination-controls';

const PAGE_SIZE = 24;
type Filters = Pick<MovieQuery, 'genre' | 'country' | 'year' | 'type' | 'sortBy'>;
const emptyFilters: Filters = {};

const quickLinks = [
  { label: 'Hành động', genre: 'hanh-dong' },
  { label: 'Tình cảm', genre: 'tinh-cam' },
  { label: 'Hài hước', genre: 'hai-huoc' },
  { label: 'Kinh dị', genre: 'kinh-di' },
  { label: 'Anime', genre: 'hoat-hinh' },
] as const;

function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [delay, value]);
  return debounced;
}

export function ExploreScreen() {
  const { gridColumns, cardWidth, contentWidth } = useMovieGridLayout(spacing.md, spacing.sm);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [recents, setRecents] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const listRef = useRef<FlashListRef<Movie>>(null);

  useEffect(() => { void cacheRepository.getRecentSearches().then(setRecents); }, []);

  const forceNetworkRef = useRef(false);
  const genres = useQuery({
    queryKey: discoveryKeys.metadata('genres'),
    queryFn: () => discoveryRepository.getGenres({ forceNetwork: forceNetworkRef.current }),
  });
  const countries = useQuery({
    queryKey: discoveryKeys.metadata('countries'),
    queryFn: () => discoveryRepository.getCountries({ forceNetwork: forceNetworkRef.current }),
  });
  const baseQuery = useMemo<Omit<MovieQuery, 'page'>>(() => ({
    limit: PAGE_SIZE,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...filters,
  }), [debouncedSearch, filters]);
  const movies = useQuery({
    queryKey: discoveryKeys.movies({ ...baseQuery, page }),
    queryFn: ({ signal }) => discoveryRepository.getMovies(
      { ...baseQuery, page },
      { signal, forceNetwork: forceNetworkRef.current },
    ),
    placeholderData: keepPreviousData,
  });
  const results = movies.data?.movies ?? [];
  const showingStale = movies.data?.stale ?? false;
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  useEffect(() => { queueMicrotask(() => setPage(1)); }, [baseQuery]);
  const suggestions = useMemo(() => {
    if (!search.trim()) return recents.map((value) => ({ label: value, value }));
    const needle = search.trim().toLocaleLowerCase('vi');
    return [...(genres.data ?? []), ...(countries.data ?? [])]
      .filter((item) => item.name.toLocaleLowerCase('vi').includes(needle))
      .slice(0, 6)
      .map((item) => ({ label: item.name, value: item.name }));
  }, [countries.data, genres.data, recents, search]);

  const saveSearch = useCallback(async (value = search) => {
    if (!value.trim()) return;
    await cacheRepository.addRecentSearch(value);
    setRecents(await cacheRepository.getRecentSearches());
  }, [search]);
  const refresh = useCallback(async () => {
    forceNetworkRef.current = true;
    try {
      await Promise.all([movies.refetch(), genres.refetch(), countries.refetch()]);
    } finally {
      forceNetworkRef.current = false;
    }
  }, [countries, genres, movies]);
  const renderMovie = useCallback(({ item }: { item: Movie }) => (
    layout === 'grid' ? (
      <View style={styles.gridItem}>
        <MovieCard movie={item} width={cardWidth} />
      </View>
    ) : (
      <View style={styles.listItem}>
        <MovieCard movie={item} layout="list" />
      </View>
    )
  ), [cardWidth, layout]);

  const header = (
    <View style={styles.header}>
      <Text style={styles.brand}>CINE<Text style={styles.brandAccent}>3D</Text></Text>
      <Text variant="headlineMedium" style={styles.title}>Khám phá</Text>
      <Text style={styles.subtitle}>Tìm phim, diễn viên và thể loại bạn thích</Text>

      <View style={styles.searchRow}>
        <Searchbar
          testID="search-input"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => void saveSearch()}
          placeholder="Tên phim, diễn viên, đạo diễn…"
          accessibilityLabel="Tìm kiếm phim"
          style={styles.search}
          inputStyle={styles.searchInput}
          icon={() => <Search color={colors.textMuted} size={20} />}
          clearIcon={() => <X color={colors.textMuted} size={20} />}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Bộ lọc, ${activeFilterCount} đang chọn`}
          onPress={() => { setDraft(filters); setFiltersVisible(true); }}
          style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
        >
          <Funnel color={activeFilterCount ? '#FFFFFF' : colors.text} size={18} />
          {activeFilterCount > 0 ? <Text style={styles.filterCount}>{activeFilterCount}</Text> : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={layout === 'grid' ? 'Chuyển sang danh sách' : 'Chuyển sang lưới'}
          onPress={() => setLayout((value) => value === 'grid' ? 'list' : 'grid')}
          style={styles.layoutButton}
        >
          {layout === 'grid' ? <List color={colors.text} size={20} /> : <Grid2X2 color={colors.text} size={20} />}
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
        {quickLinks.map((item) => {
          const selected = filters.genre === item.genre;
          return (
            <Pressable
              key={item.genre}
              onPress={() => setFilters((current) => ({
                ...current,
                genre: current.genre === item.genre ? undefined : item.genre,
              }))}
              style={[styles.quickChip, selected && styles.quickChipActive]}
            >
              <Text style={[styles.quickChipText, selected && styles.quickChipTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {suggestions.length && (!debouncedSearch || search !== debouncedSearch) ? (
        <View style={styles.suggestions}>
          {suggestions.map((item) => (
            <Chip key={item.value} compact onPress={() => { setSearch(item.value); void saveSearch(item.value); }}>{item.label}</Chip>
          ))}
          {!search && recents.length ? <Button compact onPress={() => void cacheRepository.clearRecentSearches().then(() => setRecents([]))}>Xóa gần đây</Button> : null}
        </View>
      ) : null}
      {activeFilterCount ? (
        <View style={styles.activeFilters}>
          <Text style={styles.muted}>{activeFilterCount} bộ lọc đang bật · {movies.data?.total ?? results.length} kết quả</Text>
          <Button compact onPress={() => setFilters(emptyFilters)}>Xóa bộ lọc</Button>
        </View>
      ) : (
        <Text style={styles.resultHint}>{movies.isPending ? 'Đang tải…' : `${movies.data?.total ?? results.length} phim`}</Text>
      )}
      {showingStale ? <Text style={styles.offline}>Đang hiển thị nội dung đã lưu. Kéo xuống để thử kết nối lại.</Text> : null}
      {movies.isFetching && !movies.isPending ? <Text style={styles.sync}>Đang đồng bộ nội dung mới…</Text> : null}
    </View>
  );

  return (
    <Screen testID="search-screen" edges={['top', 'left', 'right']}>
      <FlashList
        ref={listRef}
        key={`${layout}-${gridColumns}`}
        data={results}
        numColumns={layout === 'grid' ? gridColumns : 1}
        keyExtractor={(item) => item.id || item.slug}
        renderItem={renderMovie}
        ListHeaderComponent={header}
        ListEmptyComponent={movies.isPending
          ? <MovieRailSkeleton />
          : movies.error
            ? <EmptyState title="Không thể tìm kiếm" message={`${movies.error.message}. Kiểm tra kết nối rồi thử lại.`} />
            : <EmptyState title="Không có kết quả" message="Thử từ khóa khác hoặc xóa bớt bộ lọc." />}
        ListFooterComponent={<PaginationControls page={movies.data?.page ?? page} totalPages={movies.data?.totalPages ?? 1} disabled={movies.isFetching} onPage={(nextPage) => { setPage(nextPage); listRef.current?.scrollToOffset({ offset: 0, animated: true }); }} />}
        refreshControl={<RefreshControl refreshing={movies.isRefetching} onRefresh={() => void refresh()} tintColor={colors.primary} />}
        contentContainerStyle={[styles.content, { width: contentWidth, alignSelf: 'center' }]}
      />
      <FilterModal
        visible={filtersVisible}
        value={draft}
        genres={genres.data ?? []}
        countries={countries.data ?? []}
        onChange={setDraft}
        onDismiss={() => setFiltersVisible(false)}
        onApply={() => { setFilters(draft); setFiltersVisible(false); }}
        onClear={() => setDraft(emptyFilters)}
      />
    </Screen>
  );
}

function FilterModal({
  visible, value, genres, countries, onChange, onDismiss, onApply, onClear,
}: {
  visible: boolean;
  value: Filters;
  genres: { name: string; slug: string }[];
  countries: { name: string; slug: string }[];
  onChange(value: Filters): void;
  onDismiss(): void;
  onApply(): void;
  onClear(): void;
}) {
  const years = [2026, 2025, 2024, 2023, 2022, 2021];
  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
        <ScrollView contentContainerStyle={styles.modalContent}>
        <Text variant="headlineSmall" style={styles.title}>Bộ lọc</Text>
        <Text variant="titleSmall">Loại</Text>
        <SegmentedButtons
          value={value.type ?? ''}
          onValueChange={(type) => onChange({ ...value, type: (type || undefined) as MovieType | undefined })}
          buttons={[
            { value: '', label: 'Tất cả' },
            { value: 'movie', label: 'Phim lẻ' },
            { value: 'series', label: 'Phim bộ' },
            { value: 'anime', label: 'Anime' },
          ]}
        />
        <Text variant="titleSmall">Sắp xếp</Text>
        <SegmentedButtons
          value={value.sortBy ?? 'updatedAt'}
          onValueChange={(sortBy) => onChange({ ...value, sortBy: sortBy as MovieSort })}
          buttons={[
            { value: 'updatedAt', label: 'Mới nhất' },
            { value: 'views', label: 'Lượt xem' },
            { value: 'ratingAvg', label: 'Điểm' },
          ]}
        />
        <Text variant="titleSmall">Thể loại</Text>
        <View style={styles.chips}>{genres.slice(0, 12).map((item) => <Chip key={item.slug} selected={value.genre === item.slug} onPress={() => onChange({ ...value, genre: value.genre === item.slug ? undefined : item.slug })}>{item.name}</Chip>)}</View>
        <Text variant="titleSmall">Quốc gia</Text>
        <View style={styles.chips}>{countries.slice(0, 10).map((item) => <Chip key={item.slug} selected={value.country === item.slug} onPress={() => onChange({ ...value, country: value.country === item.slug ? undefined : item.slug })}>{item.name}</Chip>)}</View>
        <Text variant="titleSmall">Năm</Text>
        <View style={styles.chips}>{years.map((year) => <Chip key={year} selected={value.year === year} onPress={() => onChange({ ...value, year: value.year === year ? undefined : year })}>{year}</Chip>)}</View>
        <Divider />
        <View style={styles.modalActions}>
          <Button onPress={onClear}>Đặt lại</Button>
          <Button mode="contained" onPress={onApply}>Áp dụng</Button>
        </View>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.sm },
  brand: { color: colors.text, fontSize: 13, fontWeight: '800', letterSpacing: 1.2 },
  brandAccent: { color: colors.primary },
  title: { fontWeight: '900', marginTop: 2 },
  subtitle: { color: colors.textMuted, marginBottom: spacing.xs },
  muted: { color: colors.textMuted },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  search: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    elevation: 0,
  },
  searchInput: { minHeight: 44 },
  filterButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  filterButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterCount: { position: 'absolute', top: 6, right: 8, color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  layoutButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  quickRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  quickChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  quickChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  quickChipText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  quickChipTextActive: { color: '#FFFFFF' },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  activeFilters: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultHint: { color: colors.textMuted, fontSize: 13 },
  sync: { color: colors.warning, fontSize: 12 },
  offline: { color: colors.warning, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised },
  gridItem: { flex: 1, alignItems: 'center', paddingBottom: spacing.md },
  listItem: { paddingHorizontal: spacing.md },
  modal: { margin: spacing.md, maxHeight: '92%', backgroundColor: colors.surface, borderRadius: radius.lg },
  modalContent: { padding: spacing.lg, gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
