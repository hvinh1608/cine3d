import {
  Component,
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Button, Card, Snackbar, Text } from 'react-native-paper';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import type { Movie } from '@/domain/models';
import { colors, radius, spacing } from '@/theme';
import { MIN_TOUCH_TARGET, useAccessibilityPreferences } from '@/core/accessibility';
import { redactErrorMessage } from '@/core/reliability';

export function Screen({
  children,
  edges = ['top', 'left', 'right'],
  testID,
}: PropsWithChildren<{ edges?: Edge[]; testID?: string }>) {
  return <SafeAreaView testID={testID} style={styles.screen} edges={edges}>{children}</SafeAreaView>;
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.center} accessibilityRole="summary">
      <Text variant="titleMedium">{title}</Text>
      <Text style={styles.muted}>{message}</Text>
    </View>
  );
}

export function AsyncState({
  loading,
  error,
  empty,
  onRetry,
  children,
}: PropsWithChildren<{ loading: boolean; error?: Error | null; empty?: boolean; onRetry(): void }>) {
  useEffect(() => {
    if (error) AccessibilityInfo.announceForAccessibility('Không thể tải nội dung');
  }, [error]);
  if (loading) return <MovieRailSkeleton />;
  if (error) {
    return (
      <View style={styles.center} accessibilityRole="alert" accessibilityLiveRegion="assertive">
        <Text variant="titleMedium">Không thể tải nội dung</Text>
        <Text style={styles.muted}>{redactErrorMessage(error)}</Text>
        <Button mode="contained" accessibilityHint="Tải lại nội dung" onPress={onRetry}>Thử lại</Button>
      </View>
    );
  }
  if (empty) return <EmptyState title="Chưa có nội dung" message="Hãy quay lại sau nhé." />;
  return <>{children}</>;
}

export function Shimmer({ width, height }: { width: number | `${number}%`; height: number }) {
  const opacity = useRef(new Animated.Value(0.35)).current;
  const { reduceMotion, reduceTransparency } = useAccessibilityPreferences();
  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(0.55);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.8, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 650, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, reduceMotion]);
  return <Animated.View accessible={false} style={[styles.shimmer, reduceTransparency && styles.opaque, { width, height, opacity }]} />;
}

export function MovieRailSkeleton() {
  return (
    <View style={styles.skeletonRail}>
      <Shimmer width="55%" height={24} />
      <View style={styles.skeletonRow}>
        {[0, 1, 2].map((item) => <Shimmer key={item} width={124} height={186} />)}
      </View>
    </View>
  );
}

function movieBadge(movie: Movie): string | null {
  if (movie.isEarlyAccess) return 'SỚM';
  if (movie.isVip || movie.requiresVip) return 'VIP';
  return null;
}

export const MovieCard = memo(function MovieCard({ movie, layout = 'poster', width = 124 }: { movie: Movie; layout?: 'poster' | 'list'; width?: number }) {
  const { reduceMotion } = useAccessibilityPreferences();
  const badge = movieBadge(movie);
  const rating = movie.ratingAvg > 0 ? movie.ratingAvg.toFixed(1) : null;
  const posterSource = movie.posterUrl || movie.backdropUrl || undefined;
  const posterHeight = Math.round(width * 1.5);
  return (
    <Link href={{ pathname: '/movies/[slug]', params: { slug: movie.slug } }} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Mở ${movie.title}`}
        accessibilityHint="Mở trang chi tiết phim"
        android_ripple={{ color: 'rgba(250, 250, 250, 0.12)', foreground: true }}
        style={layout === 'list' ? styles.movieListCard : [styles.movieCard, { width, maxWidth: width }]}
      >
        <View style={layout === 'list' ? styles.listPosterWrap : [styles.posterWrap, { width, height: posterHeight }]}>
          <Image
            accessible={false}
            source={posterSource}
            style={layout === 'list' ? styles.listPoster : { width, height: posterHeight }}
            contentFit="cover"
            transition={reduceMotion ? 0 : 120}
            cachePolicy="memory-disk"
            recyclingKey={posterSource || movie.slug}
          />
          {movie.quality ? (
            <View style={styles.qualityBadge}><Text style={styles.badgeText}>{movie.quality}</Text></View>
          ) : null}
          {badge ? (
            <View style={styles.vipBadge}><Text style={styles.badgeText}>{badge}</Text></View>
          ) : null}
          {movie.isSeries && movie.episodeCount ? (
            <View style={styles.episodeBadge}><Text style={styles.badgeText}>{movie.episodeCount} tập</Text></View>
          ) : null}
        </View>
        <View style={layout === 'list' ? styles.listBody : [styles.posterBody, { width }]}>
          <Text numberOfLines={layout === 'list' ? 2 : 1} ellipsizeMode="tail" variant="labelLarge" style={styles.cardTitle}>{movie.title}</Text>
          <Text numberOfLines={1} ellipsizeMode="tail" variant="labelSmall" style={styles.muted}>
            {movie.releaseYear || '—'}{rating ? ` · ★ ${rating}` : ''}
          </Text>
          {layout === 'list' && movie.description ? <Text numberOfLines={2} style={styles.muted}>{movie.description}</Text> : null}
        </View>
      </Pressable>
    </Link>
  );
});

export const MovieRail = memo(function MovieRail({ title, movies }: { title: string; movies: Movie[] }) {
  const items = movies.slice(0, 18);
  if (!items.length) return null;
  return (
    <View style={styles.rail}>
      <Text variant="titleLarge" style={styles.railTitle}>{title}</Text>
      <ScrollView
        horizontal
        nestedScrollEnabled
        accessibilityRole="list"
        accessibilityLabel={title}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railContent}
      >
        {items.map((movie) => (
          <MovieCard key={`${title}:${movie.id || movie.slug}`} movie={movie} />
        ))}
      </ScrollView>
    </View>
  );
});

type ToastApi = { show(message: string): void };
const ToastContext = createContext<ToastApi>({ show: () => undefined });
export const useToast = () => useContext(ToastContext);

export function ToastHost({ children }: PropsWithChildren) {
  const [message, setMessage] = useState('');
  const value = useMemo(() => ({ show: (next: string) => {
    setMessage(next);
    AccessibilityInfo.announceForAccessibility(next);
  } }), []);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar accessibilityRole="alert" visible={Boolean(message)} onDismiss={() => setMessage('')} duration={3500}>
        {message}
      </Snackbar>
    </ToastContext.Provider>
  );
}

interface BoundaryState { error: Error | null }
export class ErrorBoundary extends Component<PropsWithChildren, BoundaryState> {
  state: BoundaryState = { error: null };
  static getDerivedStateFromError(error: Error): BoundaryState { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) console.error('Uncaught render error', error, info.componentStack);
  }
  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.boundary} accessibilityRole="alert">
        <Card mode="contained">
          <Card.Content>
            <Text variant="headlineSmall">Đã xảy ra lỗi</Text>
            <Text style={styles.muted}>Ứng dụng gặp sự cố không mong muốn.</Text>
          </Card.Content>
          <Card.Actions>
            <Button onPress={() => this.setState({ error: null })}>Thử lại</Button>
          </Card.Actions>
        </Card>
      </View>
    );
  }
}

export function useRefreshAction(action: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  return {
    refreshing,
    refresh: useCallback(async () => {
      setRefreshing(true);
      try { await action(); } finally { setRefreshing(false); }
    }, [action]),
  };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  muted: { color: colors.textMuted },
  shimmer: { backgroundColor: colors.surfaceRaised, borderRadius: radius.sm },
  skeletonRail: { gap: spacing.md, padding: spacing.md },
  skeletonRow: { flexDirection: 'row', gap: spacing.md },
  movieCard: {
    gap: spacing.xs,
    minHeight: MIN_TOUCH_TARGET,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  movieListCard: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm, minHeight: 136 },
  posterWrap: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  listPosterWrap: {
    width: 84,
    height: 126,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  listPoster: { width: 84, height: 126 },
  listBody: { flex: 1, gap: spacing.sm, justifyContent: 'center' },
  posterBody: { gap: 2, paddingHorizontal: 2 },
  cardTitle: { fontWeight: '600' },
  qualityBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(9, 9, 11, 0.78)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(250, 250, 250, 0.24)',
  },
  vipBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#B8860B',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  episodeBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  rail: { gap: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.xs },
  railTitle: { paddingHorizontal: spacing.md, fontWeight: '800', fontSize: 19 },
  railContent: { paddingHorizontal: spacing.md, gap: spacing.md },
  boundary: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
  opaque: { backgroundColor: colors.border },
});
