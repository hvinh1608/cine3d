import { useEffect, useState } from 'react';
import { AccessibilityInfo, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { Button, Divider, SegmentedButtons, Switch, Text } from 'react-native-paper';
import { cacheRepository } from '@/data/cache/sqlite-cache';
import { downloadRepository } from '@/features/player/data/player-storage';
import { useAppStore } from '@/state/app-store';
import type { AppPreferences } from '@/features/account/data/settings-storage';
import { colors, radius, spacing } from '@/theme';

function Row({ label, value, onChange }: { label: string; value: boolean; onChange(value: boolean): void }) {
  return <View style={styles.row}><Text>{label}</Text><Switch accessibilityLabel={label} accessibilityRole="switch" value={value} onValueChange={onChange} /></View>;
}
function bytes(value: number) { return value < 1024 * 1024 ? `${Math.round(value / 1024)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`; }

export default function SettingsRoute() {
  const preferences = useAppStore((state) => state.preferences);
  const setPreference = useAppStore((state) => state.setPreference);
  const [usage, setUsage] = useState({ cache: 0, downloads: 0, count: 0 });
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (message) AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
  const refreshUsage = async () => {
    const [cache, downloads] = await Promise.all([cacheRepository.storageBytes(), downloadRepository.list()]);
    setUsage({ cache, downloads: downloads.reduce((sum, item) => sum + item.totalBytes, 0), count: downloads.length });
  };
  useEffect(() => { void refreshUsage(); }, []);
  const set = <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => void setPreference(key, value);
  const toggleLock = async (enabled: boolean) => {
    if (enabled) {
      const [hardware, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
      if (!hardware || !enrolled) return setMessage('Thiết bị chưa có sinh trắc học hoặc mã khóa thiết bị.');
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Bật khóa CINE3D', disableDeviceFallback: false });
      if (!result.success) return;
    }
    await setPreference('biometricLock', enabled);
  };
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text variant="headlineSmall">Cài đặt</Text>
      <Text variant="titleMedium">Giao diện và ngôn ngữ</Text>
      <SegmentedButtons value={preferences.theme} onValueChange={(value) => set('theme', value as AppPreferences['theme'])} buttons={[{ value: 'system', label: 'Hệ thống' }, { value: 'dark', label: 'Tối' }]} />
      <Text style={styles.muted}>CINE3D luôn dùng bảng màu tối; “Hệ thống” chỉ đồng bộ hành vi hệ điều hành.</Text>
      <SegmentedButtons value={preferences.language} onValueChange={(value) => set('language', value as AppPreferences['language'])} buttons={[{ value: 'vi', label: 'Tiếng Việt' }, { value: 'en', label: 'English' }]} />
      <Divider />
      <Text variant="titleMedium">Phát và dữ liệu</Text>
      <Row label="Tự động phát tập tiếp" value={preferences.autoplay} onChange={(value) => set('autoplay', value)} />
      <Row label="Tiết kiệm dữ liệu" value={preferences.dataSaver} onChange={(value) => set('dataSaver', value)} />
      <SegmentedButtons value={preferences.streamingQuality} onValueChange={(value) => set('streamingQuality', value as AppPreferences['streamingQuality'])} buttons={[{ value: 'auto', label: 'Tự động' }, { value: '720p', label: '720p' }, { value: '1080p', label: '1080p' }]} />
      <Row label="Bật phụ đề" value={preferences.subtitlesEnabled} onChange={(value) => set('subtitlesEnabled', value)} />
      <SegmentedButtons value={preferences.subtitleLanguage} onValueChange={(value) => set('subtitleLanguage', value as AppPreferences['subtitleLanguage'])} buttons={[{ value: 'vi', label: 'Phụ đề Việt' }, { value: 'en', label: 'English' }]} />
      <SegmentedButtons value={String(preferences.subtitleSize)} onValueChange={(value) => set('subtitleSize', Number(value))} buttons={[{ value: '85', label: 'Chữ nhỏ' }, { value: '100', label: 'Vừa' }, { value: '125', label: 'Chữ lớn' }]} />
      <SegmentedButtons value={preferences.downloadQuality} onValueChange={(value) => set('downloadQuality', value as AppPreferences['downloadQuality'])} buttons={[{ value: '720p', label: 'Tải 720p' }, { value: '1080p', label: 'Tải 1080p' }]} />
      <Row label="Giảm chuyển động" value={preferences.reduceMotion} onChange={(value) => set('reduceMotion', value)} />
      <Divider />
      <Text variant="titleMedium">Bảo mật</Text>
      <Row label="Khóa ứng dụng" value={preferences.biometricLock} onChange={(value) => void toggleLock(value)} />
      <Text style={styles.muted}>Dùng sinh trắc học, sau đó cho phép mã khóa thiết bị làm phương án dự phòng.</Text>
      <Divider />
      <Text variant="titleMedium">Bộ nhớ</Text>
      <Text>Cache: {bytes(usage.cache)} · {usage.count} bản tải: {bytes(usage.downloads)}</Text>
      <Button mode="outlined" onPress={() => router.push('/downloads')}>Quản lý nội dung đã tải</Button>
      <Button onPress={() => Alert.alert('Xóa cache?', 'Nội dung tải ngoại tuyến không bị xóa.', [{ text: 'Hủy' }, { text: 'Xóa', onPress: () => void cacheRepository.clearAll().then(refreshUsage) }])}>Xóa cache</Button>
      {message ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: spacing.md, gap: spacing.md },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface },
  muted: { color: colors.textMuted }, message: { color: colors.warning },
});
