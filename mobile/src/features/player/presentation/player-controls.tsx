import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import Slider from '@react-native-community/slider';
import {
  Cast, ChevronLeft, Download, Expand, Flag, Gauge, ListVideo, Maximize, Minimize,
  Pause, PictureInPicture, Play, RotateCcw, RotateCw, Share2, Volume2, VolumeX,
} from 'lucide-react-native';
import type { AudioTrack, SubtitleTrack, VideoPlayer } from 'expo-video';
import { Button, Chip, IconButton, Switch, Text, TextInput } from 'react-native-paper';
import type { Episode, VideoSource } from '@/domain/models';
import { useAppStore } from '@/state/app-store';
import { colors, radius, spacing } from '@/theme';
import { useAccessibilityPreferences } from '@/core/accessibility';

interface Props {
  player: VideoPlayer;
  movieTitle: string;
  slug: string;
  episode: Episode;
  episodes: Episode[];
  source: VideoSource;
  sources: VideoSource[];
  position: number;
  duration: number;
  playing: boolean;
  fullscreen: boolean;
  compact: boolean;
  chromeVisible: boolean;
  contentFit: 'contain' | 'cover' | 'fill';
  tracks: { subtitles: SubtitleTrack[]; audio: AudioTrack[] };
  countdown: number | null;
  topInset?: number;
  onBack(): void;
  onInteraction(): void;
  onSheetChange(open: boolean): void;
  onTogglePlay(): void;
  onSeek(value: number): void;
  onSeekBy(value: number): void;
  onFullscreen(): void;
  onPiP(): void;
  onEpisode(value: Episode): void;
  onSource(value: VideoSource): void;
  onContentFit(value: 'contain' | 'cover'): void;
  onCancelCountdown(): void;
  onDownload(): void;
  onReport(content: string): Promise<void>;
}

export function PlayerControls(props: Props) {
  const { reduceMotion, reduceTransparency } = useAccessibilityPreferences();
  const [settings, setSettings] = useState(false);
  const [episodesOpen, setEpisodesOpen] = useState(false);
  const [episodeSearch, setEpisodeSearch] = useState('');
  const [season, setSeason] = useState(props.episode.seasonNumber ?? 1);
  const [reportOpen, setReportOpen] = useState(false);
  const [report, setReport] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const dataSaver = useAppStore((state) => state.preferences.dataSaver);
  const autoNext = useAppStore((state) => state.preferences.autoplay);
  const setPreference = useAppStore((state) => state.setPreference);
  const filteredEpisodes = useMemo(() => {
    const query = episodeSearch.trim().toLocaleLowerCase('vi');
    return props.episodes.filter((item) => (item.seasonNumber ?? 1) === season && (!query || item.title.toLocaleLowerCase('vi').includes(query) || String(item.episodeOrder).includes(query)));
  }, [episodeSearch, props.episodes, season]);
  const seasons = useMemo(() => [...new Set(props.episodes.map((item) => item.seasonNumber ?? 1))].sort((a, b) => a - b), [props.episodes]);
  const sheetOpen = settings || episodesOpen || reportOpen;
  const showChrome = props.chromeVisible || sheetOpen || props.countdown != null;
  const touch = () => props.onInteraction();

  useEffect(() => {
    props.onSheetChange(sheetOpen);
  }, [props.onSheetChange, sheetOpen]);

  const openSettings = () => { touch(); setSettings(true); };
  const openEpisodes = () => { touch(); setEpisodesOpen(true); };
  const openReport = () => { touch(); setReportOpen(true); };

  return (
    <>
      {showChrome ? (
        <View style={[styles.root, { paddingTop: Math.max(spacing.sm, props.topInset ?? 0) }]} pointerEvents="box-none">
          <View style={styles.titleBar}>
            <IconButton
              icon={() => <ChevronLeft color={colors.text} />}
              accessibilityLabel="Quay lại"
              onPress={() => { touch(); props.onBack(); }}
            />
            <View style={styles.titleCopy}>
              <Text variant="titleMedium" numberOfLines={1}>{props.movieTitle}</Text>
              <Text variant="bodySmall" style={styles.muted}>{props.episode.title} · {props.source.server} · {props.source.quality}</Text>
            </View>
            <IconButton icon={() => <PictureInPicture color={colors.text} />} accessibilityLabel="Thu nhỏ vào Picture in Picture" onPress={() => { touch(); props.onPiP(); }} />
            <IconButton
              icon={() => props.fullscreen ? <Minimize color={colors.text} /> : <Maximize color={colors.text} />}
              accessibilityLabel={props.fullscreen ? 'Thoát toàn màn hình' : 'Xem ngang toàn màn hình'}
              onPress={() => { touch(); props.onFullscreen(); }}
            />
          </View>

          <View style={styles.centerControls}>
            <IconButton icon={() => <RotateCcw color={colors.text} />} size={34} accessibilityLabel="Lùi 10 giây" onPress={() => { touch(); props.onSeekBy(-10); }} />
            <IconButton
              style={styles.playButton}
              icon={() => props.playing ? <Pause color={colors.text} fill={colors.text} /> : <Play color={colors.text} fill={colors.text} />}
              size={44}
              accessibilityLabel={props.playing ? 'Tạm dừng' : 'Phát'}
              onPress={() => { touch(); props.onTogglePlay(); }}
            />
            <IconButton icon={() => <RotateCw color={colors.text} />} size={34} accessibilityLabel="Tiến 10 giây" onPress={() => { touch(); props.onSeekBy(10); }} />
          </View>

          <View style={styles.bottom}>
            {props.episode.introEndSeconds != null && props.position < props.episode.introEndSeconds && props.episode.introEndSeconds > 5 ? (
              <Button mode="contained-tonal" compact onPress={() => { touch(); props.onSeek(props.episode.introEndSeconds!); }}>Bỏ qua intro</Button>
            ) : null}
            {props.episode.outroStartSeconds != null
              && props.duration > 60
              && props.episode.outroStartSeconds > props.duration * 0.7
              && props.position >= props.episode.outroStartSeconds ? (
              <Button mode="contained" compact onPress={() => {
                touch();
                const next = props.episodes[props.episodes.findIndex((item) => item.id === props.episode.id) + 1];
                if (next) props.onEpisode(next);
              }}>
                Bỏ qua outro · Tập tiếp
              </Button>
            ) : null}
            <View style={styles.timeline}>
              <Text variant="labelSmall">{formatTime(props.position)}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={Math.max(1, props.duration)}
                value={props.position}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor="rgba(255,255,255,.4)"
                thumbTintColor={colors.primary}
                onSlidingStart={touch}
                onSlidingComplete={(value) => { touch(); props.onSeek(value); }}
                accessibilityLabel="Tiến trình phát"
                accessibilityRole="adjustable"
                accessibilityValue={{ min: 0, max: Math.round(props.duration), now: Math.round(props.position), text: `${formatTime(props.position)} trên ${formatTime(props.duration)}` }}
              />
              <Text variant="labelSmall">{formatTime(props.duration)}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions}>
              <IconButton icon={() => props.player.muted ? <VolumeX color={colors.text} /> : <Volume2 color={colors.text} />} accessibilityLabel={props.player.muted ? 'Bật tiếng' : 'Tắt tiếng'} onPress={() => { touch(); props.player.muted = !props.player.muted; }} />
              <IconButton icon={() => <ListVideo color={colors.text} />} accessibilityLabel="Danh sách tập" onPress={openEpisodes} />
              <IconButton icon={() => <Gauge color={colors.text} />} accessibilityLabel="Tốc độ và nguồn phát" onPress={openSettings} />
              <IconButton icon={() => <Download color={colors.text} />} accessibilityLabel="Tải xuống" onPress={() => { touch(); props.onDownload(); }} />
              <IconButton icon={() => <Share2 color={colors.text} />} accessibilityLabel="Chia sẻ" onPress={() => { touch(); void Share.share({ title: props.movieTitle, message: `${props.movieTitle}\nhttps://cine3d.id.vn/watch/${props.slug}?ep=${props.episode.episodeOrder}` }); }} />
              <IconButton icon={() => <Flag color={colors.text} />} accessibilityLabel="Báo lỗi phát phim" onPress={openReport} />
            </ScrollView>
          </View>
        </View>
      ) : null}

      {props.countdown != null ? (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.countdown}>
          <Text>Tập tiếp theo sau {props.countdown} giây</Text>
          <Button compact onPress={() => { touch(); props.onCancelCountdown(); }}>Hủy</Button>
        </View>
      ) : null}

      <Modal visible={settings} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={() => setSettings(false)}>
        <View style={styles.modalRoot}>
          <Pressable accessibilityRole="button" accessibilityLabel="Đóng tùy chọn phát" style={[styles.scrim, reduceTransparency && styles.scrimOpaque]} onPress={() => setSettings(false)} />
          <ScrollView accessibilityViewIsModal style={styles.sheet} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            <Text variant="titleLarge">Tùy chọn phát</Text>
            <Text>Tốc độ</Text>
            <View style={styles.chips}>{[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => <Chip key={rate} selected={props.player.playbackRate === rate} onPress={() => { props.player.playbackRate = rate; }}>{rate}×</Chip>)}</View>
            <Text>Âm lượng</Text>
            <Slider minimumValue={0} maximumValue={1} value={props.player.volume} onValueChange={(value) => { props.player.volume = value; }} minimumTrackTintColor={colors.primary} thumbTintColor={colors.primary} />
            <Text>Nguồn / chất lượng</Text>
            <View style={styles.chips}>{props.sources.map((item) => <Chip key={item.id} selected={item.id === props.source.id} onPress={() => props.onSource(item)}>{item.server} · {item.quality}</Chip>)}</View>
            <Text>Phụ đề trong luồng</Text>
            <View style={styles.chips}>
              <Chip selected={!props.player.subtitleTrack} onPress={() => { props.player.subtitleTrack = null; }}>Tắt</Chip>
              {props.tracks.subtitles.map((track, index) => <Chip key={track.id ?? `${track.language}-${index}`} selected={props.player.subtitleTrack?.id === track.id} onPress={() => { props.player.subtitleTrack = track; }}>{track.label || track.language}</Chip>)}
            </View>
            {!props.tracks.subtitles.length ? <Text style={styles.muted}>Nguồn này không cung cấp track phụ đề nhúng.</Text> : null}
            <Text>Âm thanh</Text>
            <View style={styles.chips}>{props.tracks.audio.map((track, index) => <Chip key={track.id ?? `${track.language}-${index}`} selected={props.player.audioTrack?.id === track.id} onPress={() => { props.player.audioTrack = track; }}>{track.label || track.language}</Chip>)}</View>
            {!props.tracks.audio.length ? <Text style={styles.muted}>Nguồn không công bố track âm thanh có thể chọn.</Text> : null}
            <View style={styles.settingRow}><Text>Tự động phát tập tiếp</Text><Switch value={autoNext} onValueChange={(value) => setPreference('autoplay', value)} /></View>
            <View style={styles.settingRow}><Text>Tiết kiệm dữ liệu</Text><Switch value={dataSaver} onValueChange={(value) => setPreference('dataSaver', value)} /></View>
            <View style={styles.chips}><Chip icon={() => <Expand size={16} color={colors.text} />} selected={props.contentFit === 'contain'} onPress={() => props.onContentFit('contain')}>Vừa khung</Chip><Chip selected={props.contentFit === 'cover'} onPress={() => props.onContentFit('cover')}>Lấp đầy</Chip></View>
            <Button icon={() => <Cast size={18} color={colors.textMuted} />} disabled>Chromecast chưa khả dụng</Button>
            <Button onPress={() => setSettings(false)}>Đóng</Button>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={episodesOpen} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={() => setEpisodesOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable accessibilityRole="button" accessibilityLabel="Đóng danh sách tập" style={[styles.scrim, reduceTransparency && styles.scrimOpaque]} onPress={() => setEpisodesOpen(false)} />
          <View accessibilityViewIsModal style={styles.sheet}>
            <Text variant="titleLarge">Tập phim</Text>
            {seasons.length > 1 ? <ScrollView horizontal contentContainerStyle={styles.chips}>{seasons.map((item) => <Chip key={item} selected={season === item} onPress={() => setSeason(item)}>Mùa {item}</Chip>)}</ScrollView> : null}
            <TextInput mode="outlined" dense value={episodeSearch} onChangeText={setEpisodeSearch} placeholder="Tìm tên hoặc số tập" returnKeyType="search" accessibilityLabel="Tìm tập phim" />
            <ScrollView style={styles.episodeList} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
              {filteredEpisodes.map((item) => (
                <Chip key={item.id} selected={item.id === props.episode.id} onPress={() => { props.onEpisode(item); setEpisodesOpen(false); }}>
                  M{item.seasonNumber ?? 1} · {item.title}
                </Chip>
              ))}
            </ScrollView>
            <Button onPress={() => setEpisodesOpen(false)}>Đóng</Button>
          </View>
        </View>
      </Modal>

      <Modal visible={reportOpen} transparent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={() => setReportOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable accessibilityRole="button" accessibilityLabel="Đóng báo lỗi" style={[styles.scrim, reduceTransparency && styles.scrimOpaque]} onPress={() => setReportOpen(false)} />
          <View accessibilityViewIsModal style={styles.sheet}>
            <Text variant="titleLarge">Báo lỗi phát phim</Text>
            <TextInput mode="outlined" multiline value={report} onChangeText={setReport} placeholder="Mô tả lỗi âm thanh, hình ảnh hoặc phụ đề" accessibilityLabel="Mô tả lỗi phát phim" />
            <Button mode="contained" loading={submitting} disabled={submitting || report.trim().length < 5} accessibilityState={{ disabled: submitting || report.trim().length < 5, busy: submitting }} onPress={() => {
              if (submitting) return;
              setSubmitting(true);
              void props.onReport(report).then(() => {
                AccessibilityInfo.announceForAccessibility('Đã gửi báo cáo');
                setReport('');
                setReportOpen(false);
              }).catch(() => AccessibilityInfo.announceForAccessibility('Không thể gửi báo cáo')).finally(() => setSubmitting(false));
            }}>Gửi báo cáo</Button>
            <Button onPress={() => setReportOpen(false)}>Hủy</Button>
          </View>
        </View>
      </Modal>
    </>
  );
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00';
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const tail = `${String(minutes).padStart(hours ? 2 : 1, '0')}:${String(value % 60).padStart(2, '0')}`;
  return hours ? `${hours}:${tail}` : tail;
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'space-between', paddingHorizontal: spacing.sm, paddingBottom: spacing.sm, backgroundColor: 'rgba(0,0,0,.28)' },
  titleBar: { flexDirection: 'row', alignItems: 'center' },
  titleCopy: { flex: 1, paddingHorizontal: spacing.xs },
  centerControls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  playButton: { backgroundColor: 'rgba(255,255,255,.18)' },
  bottom: { gap: spacing.xs },
  timeline: { flexDirection: 'row', alignItems: 'center' },
  slider: { flex: 1, height: 36 },
  actions: { alignItems: 'center' },
  muted: { color: colors.textMuted },
  countdown: { position: 'absolute', right: spacing.md, bottom: 86, borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.surfaceRaised, alignItems: 'center' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,.7)' },
  scrimOpaque: { backgroundColor: '#000' },
  sheet: { maxHeight: '80%', padding: spacing.lg, gap: spacing.md, backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  sheetContent: { gap: spacing.md, paddingBottom: spacing.xl },
  episodeList: { maxHeight: 320 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
