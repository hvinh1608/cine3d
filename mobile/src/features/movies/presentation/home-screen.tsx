import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Play } from 'lucide-react-native';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AsyncState, MovieRail, Screen } from '@/components/ui';
import type { Banner } from '@/domain/models';
import { discoveryRepository } from '@/features/discovery/data/http-discovery-repository';
import { discoveryKeys } from '@/features/discovery/domain/discovery-repository';
import { movieRepository } from '@/features/movies/data/http-movie-repository';
import { movieKeys } from '@/features/movies/domain/movie-repository';
import { useAppStore } from '@/state/app-store';
import { colors, spacing } from '@/theme';
import { useAccessibilityPreferences } from '@/core/accessibility';
import { useResponsiveLayout } from '@/core/responsive';

export function HomeScreen() {
  const { contentWidth } = useResponsiveLayout();
  const authenticated = useAppStore((state) => Boolean(state.session.tokens.accessToken));
  const query = useQuery({
    queryKey: movieKeys.home(),
    queryFn: () => movieRepository.getHomeFeed({ forceNetwork: true }),
  });
  const history = useQuery({
    queryKey: discoveryKeys.history(),
    queryFn: () => discoveryRepository.getHistory(),
    enabled: authenticated,
  });
  const feed = query.data;
  const continueWatching = useMemo(
    () => (history.data ?? []).filter((entry) => !entry.completed && entry.movie).map((entry) => entry.movie!),
    [history.data],
  );
  const anime = useMemo(
    () => (feed?.movies ?? []).filter((movie) => movie.movieGenres?.some(({ genre }) => genre.slug === 'hoat-hinh')),
    [feed?.movies],
  );
  const refresh = async () => {
    await Promise.all([query.refetch(), ...(authenticated ? [history.refetch()] : [])]);
  };

  return (
    <Screen testID="home-screen" edges={['left', 'right']}>
      <AsyncState
        loading={query.isPending}
        error={query.error}
        empty={!feed?.movies.length && !feed?.trending.length}
        onRetry={() => void query.refetch()}
      >
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={query.isRefetching} onRefresh={() => void refresh()} tintColor={colors.primary} />
          }
          contentContainerStyle={[styles.content, { width: contentWidth, alignSelf: 'center' }]}
        >
          <HeroCarousel banners={feed?.banners ?? []} />
          <CategoryChips />
          {feed?.partial ? <Text style={styles.notice}>Một số danh mục đang tạm thời chưa khả dụng.</Text> : null}
          <MovieRail title="Tiếp tục xem" movies={continueWatching} />
          <MovieRail title="Đề xuất cho bạn" movies={feed?.proposed ?? []} />
          <MovieRail title="Thịnh hành" movies={feed?.trending ?? []} />
          <MovieRail title="Mới cập nhật" movies={feed?.movies ?? []} />
          <MovieRail title="Hoạt hình & Anime" movies={anime} />
          <MovieRail title="Phim Hàn Quốc" movies={feed?.countries.korea ?? []} />
          <MovieRail title="Phim Trung Quốc" movies={feed?.countries.china ?? []} />
          <MovieRail title="Phim Việt Nam" movies={feed?.countries.vietnam ?? []} />
        </ScrollView>
      </AsyncState>
    </Screen>
  );
}

function HeroCarousel({ banners }: { banners: Banner[] }) {
  const { contentWidth: width, isLandscape } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const { reduceMotion, reduceTransparency } = useAccessibilityPreferences();
  useEffect(() => {
    if (reduceMotion || banners.length < 2) return;
    const timer = setInterval(() => {
      setIndex((current) => {
        const next = (current + 1) % banners.length;
        scrollRef.current?.scrollTo({ x: next * width, animated: true });
        return next;
      });
    }, 6500);
    return () => clearInterval(timer);
  }, [banners.length, reduceMotion, width]);
  if (!banners.length) return null;
  return (
    <View accessibilityRole="adjustable" accessibilityLabel={`Nổi bật, mục ${index + 1} trên ${banners.length}`}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        accessibilityLabel="Phim nổi bật"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
      >
        {banners.map((banner) => (
          <View key={banner.id} style={[styles.hero, { width, height: isLandscape ? 340 : 520 }]}>
            <Image accessible={false} source={banner.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={banner.imageUrl} />
            {reduceTransparency ? (
              <View style={styles.heroScrimOpaque} />
            ) : (
              <LinearGradient
                colors={['rgba(9,9,11,0.25)', 'rgba(9,9,11,0)', 'rgba(9,9,11,0.55)', colors.background]}
                locations={[0, 0.35, 0.72, 1]}
                style={StyleSheet.absoluteFill}
              />
            )}
            <View style={styles.heroBody}>
              <Text variant="headlineMedium" style={styles.heroTitle}>{banner.title}</Text>
              {banner.movie.englishTitle && banner.movie.englishTitle !== banner.title ? (
                <Text numberOfLines={1} style={styles.heroSubtitle}>{banner.movie.englishTitle}</Text>
              ) : null}
              <View style={styles.heroMetaRow}>
                {[String(banner.movie.releaseYear || ''), banner.movie.quality, banner.movie.isSeries ? `${banner.movie.episodeCount} tập` : 'Phim lẻ']
                  .filter(Boolean)
                  .map((meta) => (
                    <View key={meta} style={styles.heroPill}><Text style={styles.heroPillText}>{meta}</Text></View>
                  ))}
              </View>
              <View style={styles.actions}>
                <Link href={{ pathname: '/movies/[slug]', params: { slug: banner.movie.slug } }} asChild>
                  <Button
                    mode="contained"
                    icon={({ size }) => <Play size={size} color="#FFFFFF" fill="#FFFFFF" />}
                    contentStyle={styles.heroButtonContent}
                    labelStyle={styles.heroButtonLabel}
                  >
                    Xem ngay
                  </Button>
                </Link>
                <Link href={{ pathname: '/movies/[slug]', params: { slug: banner.movie.slug } }} asChild>
                  <Button mode="outlined" textColor={colors.text} style={styles.heroSecondary}>Chi tiết</Button>
                </Link>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={[styles.brandRow, { top: insets.top + spacing.sm }]} pointerEvents="none">
        <Text style={styles.brand}>CINE<Text style={styles.brandAccent}>3D</Text></Text>
      </View>
      <View style={styles.dots}>
        {banners.map((banner, dot) => <View key={banner.id} style={[styles.dot, dot === index && styles.dotActive]} />)}
      </View>
    </View>
  );
}

const categories = [
  { label: 'Hành động', href: '/the-loai/hanh-dong' },
  { label: 'Tình cảm', href: '/the-loai/tinh-cam' },
  { label: 'Hàn Quốc', href: '/quoc-gia/han-quoc' },
  { label: 'Anime', href: '/the-loai/hoat-hinh' },
  { label: 'Lịch chiếu', href: '/schedule' },
] as const;

function CategoryChips() {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
      {categories.map((category) => (
        <Link key={category.href} href={category.href} asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Mở ${category.label}`}
            android_ripple={{ color: 'rgba(250, 250, 250, 0.14)' }}
            style={styles.categoryPill}
          >
            <Text style={styles.categoryText}>{category.label}</Text>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  hero: { justifyContent: 'flex-end', backgroundColor: colors.surface },
  heroScrimOpaque: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(9, 9, 11, 0.6)' },
  heroBody: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  heroTitle: { fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 12, textShadowOffset: { width: 0, height: 2 } },
  heroSubtitle: { color: colors.textMuted, fontSize: 14 },
  heroMetaRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  heroPill: {
    backgroundColor: 'rgba(250, 250, 250, 0.12)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(250, 250, 250, 0.22)',
  },
  heroPillText: { color: colors.text, fontSize: 11, fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  heroButtonContent: { paddingHorizontal: spacing.sm, height: 46 },
  heroButtonLabel: { fontSize: 15, fontWeight: '700' },
  heroSecondary: { borderColor: 'rgba(250, 250, 250, 0.35)' },
  dots: { position: 'absolute', bottom: spacing.xs, alignSelf: 'center', flexDirection: 'row', gap: spacing.xs },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(250, 250, 250, 0.35)' },
  dotActive: { width: 18, backgroundColor: colors.primary },
  categories: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  categoryPill: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  categoryText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  brandRow: { position: 'absolute', left: spacing.md },
  brand: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 1 },
  },
  brandAccent: { color: colors.primary },
  notice: { color: colors.warning, paddingHorizontal: spacing.md, paddingTop: spacing.md },
});
