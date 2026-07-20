import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button, ProgressBar, Text } from 'react-native-paper';
import { downloadRepository, type DownloadRecord } from '@/features/player/data/player-storage';
import { colors, radius, spacing } from '@/theme';

export default function DownloadsRoute() {
  const [records, setRecords] = useState<DownloadRecord[]>([]);
  const refresh = useCallback(() => { void downloadRepository.list().then(setRecords); }, []);
  useFocusEffect(refresh);
  useEffect(() => downloadRepository.subscribe(() => refresh()), [refresh]);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text variant="headlineSmall">Nội dung đã tải</Text>
      {!records.length ? <Text style={styles.muted}>Chưa có tập phim tải ngoại tuyến.</Text> : null}
      {records.map((record) => {
        const progress = record.totalBytes > 0 ? record.bytesWritten / record.totalBytes : 0;
        return (
          <View key={record.id} style={styles.card}>
            <Text variant="titleMedium">{record.title}</Text>
            <Text style={styles.muted}>{record.quality} · {statusLabel(record.status)}</Text>
            {record.status === 'downloading' || record.status === 'paused' ? <ProgressBar progress={progress} color={colors.primary} /> : null}
            {record.totalBytes > 0 ? <Text variant="labelSmall">{Math.round(progress * 100)}% · {formatBytes(record.bytesWritten)} / {formatBytes(record.totalBytes)}</Text> : null}
            {record.error ? <Text style={styles.error}>{record.error}</Text> : null}
            <View style={styles.actions}>
              {record.status === 'completed' ? <Button mode="contained" onPress={() => router.push({ pathname: '/downloads/[id]', params: { id: record.id } })}>Phát ngoại tuyến</Button> : null}
              {record.status === 'downloading' ? <Button onPress={() => void downloadRepository.pause(record.id)}>Tạm dừng</Button> : null}
              {record.status === 'paused' ? <Button onPress={() => void downloadRepository.resume(record.id).catch((error) => Alert.alert('Không thể tiếp tục', error.message))}>Tiếp tục</Button> : null}
              {record.status === 'failed' || record.status === 'cancelled' ? <Button onPress={() => void downloadRepository.retry(record.id).catch((error) => Alert.alert('Không thể thử lại', error.message))}>Thử lại</Button> : null}
              <Button textColor={colors.primarySoft} onPress={() => Alert.alert('Xóa bản tải?', record.title, [
                { text: 'Hủy', style: 'cancel' },
                { text: 'Xóa', style: 'destructive', onPress: () => void downloadRepository.remove(record.id).then(refresh) },
              ])}>Xóa</Button>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function statusLabel(status: DownloadRecord['status']) {
  return ({ idle: 'Chờ', queued: 'Đang chờ', downloading: 'Đang tải', paused: 'Đã tạm dừng', completed: 'Sẵn sàng', failed: 'Lỗi', cancelled: 'Đã hủy' } as const)[status];
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md },
  card: { padding: spacing.md, gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  muted: { color: colors.textMuted },
  error: { color: colors.primarySoft },
});
