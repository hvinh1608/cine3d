import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { accountApi, type SessionDevice } from '@/features/account/data/account-api';
import { colors, spacing } from '@/theme';

export default function SessionsRoute() {
  const [sessions, setSessions] = useState<SessionDevice[]>([]);
  const [message, setMessage] = useState('');
  const load = () => accountApi.sessions().then(setSessions).catch((error) => setMessage(error.message));
  useEffect(() => { void load(); }, []);
  const revoke = (session: SessionDevice) => Alert.alert('Đăng xuất thiết bị?', session.deviceName || 'Thiết bị', [
    { text: 'Hủy', style: 'cancel' },
    { text: 'Đăng xuất', style: 'destructive', onPress: () => void accountApi.revokeSession(session.id).then(load).catch((error) => setMessage(error.message)) },
  ]);
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text variant="headlineSmall">Thiết bị đăng nhập</Text>
      <Button mode="outlined" onPress={() => void accountApi.revokeOthers().then((result) => { setMessage(result.message); return load(); }).catch((error) => setMessage(error.message))}>Đăng xuất mọi thiết bị khác</Button>
      {sessions.map((session) => (
        <Card key={session.id}>
          <Card.Title title={`${session.deviceName || 'Thiết bị'}${session.current ? ' · Hiện tại' : ''}`} subtitle={`${session.ipAddress || 'IP không rõ'} · ${new Date(session.lastUsedAt).toLocaleString('vi-VN')}`} />
          <Card.Actions><Button disabled={session.current} textColor={colors.primarySoft} onPress={() => revoke(session)}>Thu hồi</Button></Card.Actions>
        </Card>
      ))}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </ScrollView>
  );
}
const styles = StyleSheet.create({ page: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: spacing.md, gap: spacing.md }, message: { color: colors.warning } });
