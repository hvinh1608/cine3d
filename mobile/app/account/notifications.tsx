import { useEffect, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Button, Card, Switch, Text } from 'react-native-paper';
import { accountApi, type AccountNotification } from '@/features/account/data/account-api';
import { registerPushNotifications, updatePushPreference, type PushRegistration } from '@/features/account/data/push-service';
import { useAppStore } from '@/state/app-store';
import { colors, spacing } from '@/theme';
import { sanitizeDeepLink } from '@/core/reliability';

function openNotification(link?: string | null) {
  const route = sanitizeDeepLink(link);
  if (route) router.push(route as Href);
}

export default function NotificationsRoute() {
  const [items, setItems] = useState<AccountNotification[]>([]);
  const [registration, setRegistration] = useState<PushRegistration | null>(null);
  const enabled = useAppStore((state) => state.preferences.notificationsEnabled);
  const setPreference = useAppStore((state) => state.setPreference);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (message) AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
  const load = () => accountApi.notifications().then(setItems).catch((error) => setMessage(error.message));
  useEffect(() => { void load(); }, []);
  const configure = async () => {
    try {
      const result = await registerPushNotifications();
      setRegistration(result);
      setMessage(result.granted ? 'Đã bật thông báo cho thiết bị.' : result.reason || 'Không thể bật thông báo.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể đăng ký thông báo.'); }
  };
  const toggle = async (value: boolean) => {
    await setPreference('notificationsEnabled', value);
    if (registration?.token) await updatePushPreference(registration.token, value).catch((error) => setMessage(error.message));
  };
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text variant="headlineSmall">Thông báo</Text>
      <View style={styles.row}><Text>Cho phép thông báo đẩy</Text><Switch accessibilityLabel="Cho phép thông báo đẩy" accessibilityRole="switch" value={enabled} onValueChange={(value) => void toggle(value)} /></View>
      <Button mode="outlined" onPress={() => void configure()}>Kiểm tra quyền và đăng ký thiết bị</Button>
      <Button onPress={() => void accountApi.readAllNotifications().then(load).catch((error) => setMessage(error.message))}>Đánh dấu tất cả đã đọc</Button>
      {items.map((item) => (
        <Card key={item.id} accessibilityRole="button" accessibilityLabel={`${item.isRead ? 'Đã đọc' : 'Chưa đọc'}, ${item.title}`} mode={item.isRead ? 'outlined' : 'contained'} onPress={() => void accountApi.readNotification(item.id).then(() => { openNotification(item.link); return load(); })}>
          <Card.Title title={item.title} subtitle={new Date(item.createdAt).toLocaleString('vi-VN')} />
          <Card.Content><Text>{item.message}</Text></Card.Content>
        </Card>
      ))}
      {!items.length ? <Text style={styles.muted}>Chưa có thông báo.</Text> : null}
      {message ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: spacing.md, gap: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  muted: { color: colors.textMuted }, message: { color: colors.warning },
});
