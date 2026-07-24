import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { Image } from 'expo-image';
import { Button, Divider, List, Text } from 'react-native-paper';
import { accountApi } from '@/features/account/data/account-api';
import { useAppStore } from '@/state/app-store';
import { colors, radius, spacing } from '@/theme';

export default function AccountRoute() {
  const { hydrated, user, tokens, activeProfile } = useAppStore((state) => state.session);
  const setUser = useAppStore((state) => state.setUser);
  const setActiveProfile = useAppStore((state) => state.setActiveProfile);
  const logout = useAppStore((state) => state.logout);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!tokens.refreshToken) return;
    setLoading(true);
    setError('');
    try {
      const [nextUser, profiles] = await Promise.all([accountApi.me(), accountApi.profiles()]);
      setUser(nextUser);
      if (!activeProfile || !profiles.some((item) => item.id === activeProfile.id)) setActiveProfile(profiles[0] || null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể tải tài khoản.');
    } finally { setLoading(false); }
  }, [activeProfile, setActiveProfile, setUser, tokens.refreshToken]);
  useEffect(() => { if (hydrated && tokens.refreshToken) void refresh(); }, [hydrated, tokens.refreshToken]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hydrated) return <View style={styles.center}><Text>Đang khôi phục phiên đăng nhập…</Text></View>;
  if (!tokens.refreshToken) {
    return (
      <View style={styles.center}>
        <Text variant="headlineMedium">CINE3D ID</Text>
        <Text style={styles.muted}>Đăng nhập để đồng bộ hồ sơ, lịch sử xem, thông báo và quyền lợi VIP.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button mode="contained" onPress={() => router.push('/account/auth')}>Đăng nhập hoặc đăng ký</Button>
      </View>
    );
  }
  if (!user) return <View style={styles.center}><Text>Đang tải tài khoản…</Text></View>;

  const links = [
    ['Đăng nhập web bằng QR', 'Mở camera quét mã trên máy tính', '/qr-login', 'qrcode-scan'],
    ['Hồ sơ tài khoản', 'Đổi tên hiển thị và ảnh đại diện', '/account/profile', 'account-circle'],
    ['Hồ sơ người xem', activeProfile ? `Đang dùng: ${activeProfile.name}` : 'Tạo và chuyển hồ sơ', '/account/profiles', 'account-multiple'],
    ['VIP CINE3D', user.isVip ? 'Đang hoạt động' : 'Gói và lịch sử giao dịch', '/account/vip', 'crown'],
    ['Thông báo', 'Hộp thư và thiết lập đẩy', '/account/notifications', 'bell'],
    ['Thiết bị đăng nhập', 'Xem và thu hồi phiên', '/account/sessions', 'cellphone-link'],
    ['Góp ý và hỗ trợ', 'Lịch sử, trạng thái và phản hồi', '/account/feedback', 'message-text'],
    ['Cài đặt', 'Phát, phụ đề, tải xuống, bảo mật', '/account/settings', 'cog'],
    ['Quyền riêng tư và pháp lý', 'Điều khoản, dữ liệu và phiên bản', '/account/legal', 'shield-account'],
  ] as const;

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />} contentContainerStyle={styles.page}>
      <View style={styles.hero}>
        <Image source={user.avatar || undefined} style={styles.avatar} />
        <View style={styles.grow}>
          <Text variant="headlineSmall">{user.username}</Text>
          <Text style={styles.muted}>{user.email}</Text>
          <Text style={user.isVip ? styles.vip : styles.muted}>{user.isVip ? 'CINE3D VIP' : 'Tài khoản tiêu chuẩn'}</Text>
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.list}>
        {links.map(([title, description, href, icon], index) => (
          <View key={href}>
            <List.Item
              title={title}
              description={description}
              onPress={() => router.push(href as Href)}
              left={(props) => <List.Icon {...props} icon={icon} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
            />
            {index < links.length - 1 ? <Divider /> : null}
          </View>
        ))}
        {user.role === 'ADMIN' ? <List.Item title="Quản trị" description="Phim, thành viên, đơn VIP và vận hành" onPress={() => router.push('/admin')} left={(props) => <List.Icon {...props} icon="shield-crown" />} right={(props) => <List.Icon {...props} icon="chevron-right" />} /> : null}
      </View>
      <Button textColor={colors.primarySoft} onPress={() => void accountApi.logout(tokens.refreshToken).catch(() => undefined).finally(async () => {
        await logout();
        router.replace('/(tabs)/account');
      })}>Đăng xuất</Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md, backgroundColor: colors.background },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surfaceRaised },
  grow: { flex: 1, gap: spacing.xs },
  list: { overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.surface },
  muted: { color: colors.textMuted },
  vip: { color: colors.warning, fontWeight: '700' },
  error: { color: colors.primarySoft },
});
