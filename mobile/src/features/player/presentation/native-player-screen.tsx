import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, BackHandler, Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Brightness from 'expo-brightness';
import { NavigationBar } from 'expo-navigation-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { VideoView, isPictureInPictureSupported } from 'expo-video';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { ScrollView } from 'react-native-gesture-handler';
import { AsyncState, MovieRail } from '@/components/ui';
import type { Movie } from '@/domain/models';
import { movieRepository } from '@/features/movies/data/http-movie-repository';
import { movieKeys } from '@/features/movies/domain/movie-repository';
import { colors, radius, spacing } from '@/theme';
import { downloadRepository } from '../data/player-storage';
import { playerApi } from '../data/player-api';
import { useNativePlayer } from '../hooks/use-native-player';
import { PlayerControls } from './player-controls';
import { useAccessibilityPreferences } from '@/core/accessibility';
import { useResponsiveLayout } from '@/core/responsive';

const CONTROLS_HIDE_MS = 12_000;

export function NativePlayerScreen({ slug, episodeNumber }: { slug: string; episodeNumber?: number }) {
  const query = useQuery({ queryKey: movieKeys.detail(slug), queryFn: () => movieRepository.getMovie(slug), enabled: Boolean(slug) });
  return (
    <View testID="player-screen" style={styles.page}>
      <AsyncState loading={query.isPending} error={query.error} empty={!query.data} onRetry={() => void query.refetch()}>
        {query.data ? <LoadedPlayer movie={query.data} episodeNumber={episodeNumber} /> : null}
      </AsyncState>
    </View>
  );
}

function LoadedPlayer({ movie, episodeNumber }: { movie: Movie; episodeNumber?: number }) {
  const state = useNativePlayer(movie, episodeNumber);
  const videoRef = useRef<VideoView>(null);
  const insets = useSafeAreaInsets();
  const { width, height, isLandscape, isTablet } = useResponsiveLayout();
  const [fullscreen, setFullscreen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [gestureFeedback, setGestureFeedback] = useState<string | null>(null);
  const [brightness, setBrightness] = useState(0.5);
  const [brightnessSupported, setBrightnessSupported] = useState(true);
  const { reduceMotion, reduceTransparency } = useAccessibilityPreferences();
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetOpenRef = useRef(false);
  const fullscreenRef = useRef(false);
  const videoHeight = fullscreen
    ? height
    : compact
      ? 112
      : Math.min(width * 9 / 16, isTablet || isLandscape ? 560 : 420);
  const stageHeight = fullscreen ? height : videoHeight + (compact ? 0 : insets.top);

  useEffect(() => {
    void Brightness.isAvailableAsync().then(async (available) => {
      setBrightnessSupported(available);
      if (available) setBrightness(await Brightness.getBrightnessAsync());
    }).catch(() => setBrightnessSupported(false));
  }, []);

  useEffect(() => {
    if (state.episode) router.setParams({ ep: String(state.episode.episodeOrder) });
  }, [state.episode]);

  const showControls = useCallback((persistMs = CONTROLS_HIDE_MS) => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!sheetOpenRef.current) setControlsVisible(false);
    }, persistMs);
  }, []);

  const toggleControls = useCallback(() => {
    if (sheetOpenRef.current) return;
    setControlsVisible((visible) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (visible) return false;
      hideTimer.current = setTimeout(() => {
        if (!sheetOpenRef.current) setControlsVisible(false);
      }, CONTROLS_HIDE_MS);
      return true;
    });
  }, []);

  const handleSheetChange = useCallback((open: boolean) => {
    sheetOpenRef.current = open;
    setSheetOpen(open);
    if (open) {
      setControlsVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    } else {
      showControls();
    }
  }, [showControls]);

  useEffect(() => {
    if (state.countdown != null) {
      setControlsVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      return;
    }
    showControls();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [showControls, state.countdown, state.playing]);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  useEffect(() => {
    if (state.buffering) AccessibilityInfo.announceForAccessibility('Đang tải video');
  }, [state.buffering]);
  useEffect(() => {
    if (state.error) AccessibilityInfo.announceForAccessibility(`Lỗi trình phát. ${state.error}`);
  }, [state.error]);

  const leavePlayer = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/movies/[slug]', params: { slug: movie.slug } });
  }, [movie.slug]);

  const applyFullscreen = useCallback(async (next: boolean) => {
    fullscreenRef.current = next;
    setFullscreen(next);
    try {
      if (next) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        // Cho phép xoay lại sau khi thoát ngang
        setTimeout(() => {
          void ScreenOrientation.unlockAsync().catch(() => undefined);
        }, 350);
      }
    } catch {
      Alert.alert('Không thể xoay màn hình', 'Hãy tắt khóa xoay màn hình trên điện thoại rồi thử lại.');
    }
    if (Platform.OS === 'android') NavigationBar.setHidden(next);
  }, []);

  useEffect(() => {
    void ScreenOrientation.unlockAsync().catch(() => undefined);
    return () => {
      if (Platform.OS === 'android') NavigationBar.setHidden(false);
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (compact) return;
    if (isLandscape === fullscreenRef.current) return;
    fullscreenRef.current = isLandscape;
    setFullscreen(isLandscape);
    if (Platform.OS === 'android') NavigationBar.setHidden(isLandscape);
  }, [compact, isLandscape]);

  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (fullscreenRef.current) {
        void applyFullscreen(false);
        return true;
      }
      leavePlayer();
      return true;
    });
    return () => back.remove();
  }, [applyFullscreen, leavePlayer]);

  const feedback = useCallback((message: string) => {
    setGestureFeedback(message);
    AccessibilityInfo.announceForAccessibility(message);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setGestureFeedback(null), reduceMotion ? 300 : 900);
  }, [reduceMotion]);

  const doubleTap = useCallback((x: number) => {
    const seconds = x < width / 2 ? -10 : 10;
    state.seekBy(seconds);
    feedback(seconds < 0 ? '−10 giây' : '+10 giây');
    showControls();
  }, [feedback, showControls, state.seekBy, width]);

  const adjustGesture = useCallback((x: number, translationY: number) => {
    const delta = -translationY / Math.max(240, videoHeight);
    if (x < width / 2) {
      if (!brightnessSupported) {
        feedback('Thiết bị không hỗ trợ chỉnh độ sáng');
        return;
      }
      const value = Math.max(0.05, Math.min(1, brightness + delta));
      void Brightness.setBrightnessAsync(value).then(() => setBrightness(value)).catch(() => setBrightnessSupported(false));
      feedback(`Độ sáng ${Math.round(value * 100)}%`);
    } else {
      const value = Math.max(0, Math.min(1, state.player.volume + delta));
      state.player.volume = value;
      feedback(`Âm lượng ${Math.round(value * 100)}%`);
    }
  }, [brightness, brightnessSupported, feedback, state.player, videoHeight, width]);

  const handleSingleTap = useCallback(() => {
    if (state.countdown != null) {
      showControls();
      return;
    }
    toggleControls();
  }, [showControls, state.countdown, toggleControls]);

  const gesture = useMemo(() => Gesture.Exclusive(
    Gesture.Tap().numberOfTaps(2).maxDelay(300).runOnJS(true).onEnd((event, success) => {
      if (success) doubleTap(event.x);
    }),
    Gesture.Pan().minDistance(16).runOnJS(true).onUpdate((event) => {
      adjustGesture(event.x, event.translationY);
    }),
    Gesture.Tap().numberOfTaps(1).runOnJS(true).onEnd(() => {
      handleSingleTap();
    }),
  ), [adjustGesture, doubleTap, handleSingleTap]);

  if (movie.requiresVip) {
    return (
      <View style={styles.gate}>
        <Text variant="headlineSmall">Nội dung dành cho VIP</Text>
        <Text style={styles.muted}>Tài khoản hiện tại không có quyền phát phim hoặc tập đang trong giai đoạn truy cập sớm.</Text>
        <Button mode="contained" onPress={() => router.push('/(tabs)/account')}>Xem gói VIP</Button>
        <Button onPress={leavePlayer}>Quay lại</Button>
      </View>
    );
  }
  if (!state.episode || !state.source) {
    return (
      <View style={styles.gate}>
        <Text variant="titleLarge">Chưa thể phát</Text>
        <Text style={styles.muted}>{state.error ?? 'Không có tập hoặc nguồn phát phù hợp.'}</Text>
        <Button mode="contained" onPress={leavePlayer}>Quay lại</Button>
      </View>
    );
  }

  const download = async () => {
    const source = state.source;
    const episode = state.episode;
    if (!source || !episode) return;
    if (source.type !== 'mp4') {
      Alert.alert('Không hỗ trợ tải HLS', 'Máy chủ chưa cấp nguồn MP4 được ủy quyền cho tập này. Ứng dụng không lưu URL HLS tùy ý.');
      return;
    }
    try {
      await downloadRepository.start({ movieId: movie.id, episodeId: episode.id, sourceId: source.id, title: `${movie.title} · ${episode.title}` });
      Alert.alert('Đã bắt đầu tải', 'Bạn có thể tạm dừng, tiếp tục hoặc xóa trong mục Tải xuống.');
    } catch (error) {
      Alert.alert('Không thể tải', error instanceof Error ? error.message : 'Máy chủ từ chối tải nguồn này.');
    }
  };

  const showChrome = controlsVisible || state.countdown != null || sheetOpen;

  return (
    <View style={[styles.loaded, fullscreen && styles.fullscreen]}>
      <StatusBar hidden={fullscreen} style="light" />
      <GestureDetector gesture={gesture}>
        <View style={[styles.stage, { height: stageHeight }]}>
          <VideoView
            ref={videoRef}
            player={state.player}
            style={StyleSheet.absoluteFill}
            nativeControls={false}
            contentFit={state.contentFit}
            surfaceType="surfaceView"
            allowsPictureInPicture
            startsPictureInPictureAutomatically
            fullscreenOptions={{ enable: false, orientation: 'landscape' }}
          />
          {state.buffering ? <View accessibilityRole="progressbar" accessibilityLiveRegion="polite" style={[styles.loading, reduceTransparency && styles.loadingOpaque]}><ActivityIndicator size="large" color={colors.primary} /><Text>Đang tải nguồn {state.source.server}…</Text></View> : null}
          {state.error ? <View accessibilityRole="alert" style={[styles.loading, reduceTransparency && styles.loadingOpaque]}><Text>{state.error}</Text><Button mode="contained" onPress={state.retry}>Thử lại</Button></View> : null}
          {gestureFeedback ? <View accessibilityLiveRegion="polite" style={[styles.feedback, reduceTransparency && styles.feedbackOpaque]}><Text variant="titleMedium">{gestureFeedback}</Text></View> : null}
          {compact ? (
            <View style={[styles.compactBar, { paddingTop: insets.top }]}>
              <Button textColor={colors.text} onPress={leavePlayer}>Đóng</Button>
              <Button textColor={colors.text} onPress={state.togglePlay}>{state.playing ? 'Tạm dừng' : 'Phát'}</Button>
              <Text numberOfLines={1} style={styles.compactTitle}>{movie.title} · {state.episode.title}</Text>
              <Button onPress={() => setCompact(false)}>Mở rộng</Button>
            </View>
          ) : (
            <PlayerControls
              player={state.player}
              movieTitle={movie.title}
              slug={movie.slug}
              episode={state.episode}
              episodes={state.episodes}
              source={state.source}
              sources={state.sources}
              position={state.position}
              duration={state.duration}
              playing={state.playing}
              fullscreen={fullscreen}
              compact={compact}
              chromeVisible={showChrome}
              contentFit={state.contentFit}
              tracks={state.tracks}
              countdown={state.countdown}
              topInset={insets.top}
              onBack={leavePlayer}
              onInteraction={() => showControls()}
              onSheetChange={handleSheetChange}
              onTogglePlay={() => { state.togglePlay(); showControls(); }}
              onSeek={(value) => { state.seek(value); showControls(); }}
              onSeekBy={(value) => { state.seekBy(value); showControls(); }}
              onFullscreen={() => { void applyFullscreen(!fullscreen); showControls(); }}
              onPiP={() => {
                if (!isPictureInPictureSupported()) Alert.alert('PiP không được hỗ trợ', 'Thiết bị này không hỗ trợ Picture in Picture.');
                else void videoRef.current?.startPictureInPicture().catch(() => Alert.alert('Không thể mở PiP', 'PiP cần development/production build có plugin expo-video.'));
              }}
              onEpisode={(episode) => { state.setEpisode(episode); showControls(); }}
              onSource={(source) => { state.setSource(source); showControls(); }}
              onContentFit={state.setContentFit}
              onCancelCountdown={() => state.setCountdown(null)}
              onDownload={() => void download()}
              onReport={async (content) => {
                await playerApi.reportPlayback(movie.id, state.episode!.id, state.source!.id, content);
                Alert.alert('Đã gửi', 'Cảm ơn bạn đã báo lỗi nguồn phát.');
              }}
            />
          )}
        </View>
      </GestureDetector>
      {!fullscreen ? (
        <ScrollView contentContainerStyle={styles.details}>
          <Text variant="headlineSmall" style={styles.detailTitle}>{movie.title}</Text>
          <View style={styles.metaRow}>
            {[state.episode.title, state.source.server, state.source.quality, movie.releaseYear ? String(movie.releaseYear) : '']
              .filter(Boolean)
              .map((meta) => (
                <View key={meta} style={styles.metaPill}><Text style={styles.metaText}>{meta}</Text></View>
              ))}
          </View>
          {movie.description ? <Text numberOfLines={4} style={styles.description}>{movie.description}</Text> : null}
          {state.episodes.length > 1 ? (
            <View style={styles.episodeSection}>
              <Text variant="titleMedium" style={styles.sectionTitle}>Danh sách tập</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.episodeRow}>
                {state.episodes.map((item) => {
                  const active = item.id === state.episode?.id;
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Phát ${item.title}`}
                      onPress={() => state.setEpisode(item)}
                      style={[styles.episodeChip, active && styles.episodeChipActive]}
                    >
                      <Text style={[styles.episodeChipText, active && styles.episodeChipTextActive]}>
                        {item.episodeOrder}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
          <RelatedRail movie={movie} />
          <Text style={styles.hint}>Vuốt dọc trái chỉnh độ sáng, phải chỉnh âm lượng. Chạm đúp hai bên để tua ±10 giây.</Text>
          {!brightnessSupported ? <Text style={styles.warning}>Thiết bị này không cho ứng dụng chỉnh độ sáng màn hình.</Text> : null}
        </ScrollView>
      ) : null}
    </View>
  );
}

function RelatedRail({ movie }: { movie: Movie }) {
  const related = useQuery({
    queryKey: [...movieKeys.detail(movie.slug), 'related'],
    queryFn: () => movieRepository.getRelated(movie),
  });
  if (!related.data?.length) return null;
  return <MovieRail title="Có thể bạn sẽ thích" movies={related.data} />;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000' },
  loaded: { flex: 1, backgroundColor: colors.background },
  fullscreen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, backgroundColor: '#000' },
  stage: { width: '100%', backgroundColor: '#000', overflow: 'hidden' },
  loading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: 'rgba(0,0,0,.55)' },
  loadingOpaque: { backgroundColor: '#000' },
  feedback: { position: 'absolute', alignSelf: 'center', top: '42%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 24, backgroundColor: 'rgba(0,0,0,.72)' },
  feedbackOpaque: { backgroundColor: colors.surface },
  compactBar: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, backgroundColor: 'rgba(0,0,0,.5)' },
  compactTitle: { flex: 1 },
  details: { paddingVertical: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  detailTitle: { fontWeight: '800', paddingHorizontal: spacing.md },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingHorizontal: spacing.md },
  metaPill: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  metaText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  description: { color: colors.textMuted, lineHeight: 21, paddingHorizontal: spacing.md },
  episodeSection: { gap: spacing.sm },
  sectionTitle: { fontWeight: '800', paddingHorizontal: spacing.md },
  episodeRow: { gap: spacing.sm, paddingHorizontal: spacing.md },
  episodeChip: {
    minWidth: 52,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  episodeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  episodeChipText: { color: colors.text, fontWeight: '700' },
  episodeChipTextActive: { color: '#FFFFFF' },
  hint: { color: colors.textMuted, fontSize: 12, paddingHorizontal: spacing.md },
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.background },
  muted: { color: colors.textMuted, textAlign: 'center' },
  warning: { color: colors.warning },
});
