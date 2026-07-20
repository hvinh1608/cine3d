import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { ActivityIndicator, Text } from 'react-native-paper';
import { firstRouteParam } from '@/core/route-params';
import { downloadRepository, type DownloadRecord } from '@/features/player/data/player-storage';
import { colors, spacing } from '@/theme';

export default function OfflinePlaybackRoute() {
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = firstRouteParam(rawId) ?? '';
  const [record, setRecord] = useState<DownloadRecord | null>();
  const player = useVideoPlayer(null, (instance) => {
    instance.showNowPlayingNotification = true;
    instance.staysActiveInBackground = true;
  });

  useEffect(() => {
    void downloadRepository.get(id).then((value) => {
      setRecord(value);
      if (value?.status === 'completed') {
        void player.replaceAsync({ uri: value.localUri, contentType: 'progressive', metadata: { title: value.title } }).then(() => player.play());
      }
    });
  }, [id, player]);

  if (record === undefined) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!record || record.status !== 'completed') return <View style={styles.center}><Text>Bản tải không tồn tại hoặc chưa hoàn tất.</Text></View>;
  return (
    <View style={styles.page}>
      <VideoView player={player} style={styles.video} nativeControls allowsPictureInPicture startsPictureInPictureAutomatically contentFit="contain" fullscreenOptions={{ enable: true, orientation: 'landscape' }} />
      <View style={styles.copy}><Text variant="titleLarge">{record.title}</Text><Text style={styles.muted}>Đang phát từ bộ nhớ thiết bị · {record.quality}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  copy: { padding: spacing.md, gap: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  muted: { color: colors.textMuted },
});
