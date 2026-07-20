import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Card, List, Text } from 'react-native-paper';
import { accountApi } from '@/features/account/data/account-api';
import { colors, spacing } from '@/theme';

export default function LegalRoute() {
  const [policy, setPolicy] = useState<string>('Đang kiểm tra chính sách cập nhật…');
  useEffect(() => {
    void accountApi.versionPolicy()
      .then((value) => setPolicy(`Bản mới nhất ${value.latestVersion} · tối thiểu ${value.minVersion}${value.forceUpdate ? ' · bắt buộc cập nhật' : ''}`))
      .catch(() => setPolicy('Máy chủ chưa cấu hình chính sách phiên bản.'));
  }, []);
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text variant="headlineSmall">Quyền riêng tư và pháp lý</Text>
      {([
        ['Điều khoản dịch vụ', 'terms'], ['Chính sách quyền riêng tư', 'privacy'], ['Yêu cầu xóa dữ liệu', 'data-deletion'],
      ] as const).map(([title, document]) => <List.Item key={document} title={title} right={(props) => <List.Icon {...props} icon="chevron-right" />} onPress={() => router.push({ pathname: '/account/legal/[document]', params: { document } })} />)}
      <Card><Card.Title title={`CINE3D ${accountApi.appVersion}`} subtitle={policy} /><Card.Content><Text style={styles.muted}>Ứng dụng xem phim native cho điện thoại và máy tính bảng. Liên hệ: hvinh.job@gmail.com</Text></Card.Content></Card>
    </ScrollView>
  );
}
const styles = StyleSheet.create({ page: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: spacing.md, gap: spacing.md }, muted: { color: colors.textMuted } });
