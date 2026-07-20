import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { accountApi, type VipOrder, type VipPlan } from '@/features/account/data/account-api';
import { useAppStore } from '@/state/app-store';
import { colors, radius, spacing } from '@/theme';

const VIP_WEB_URL = 'https://cine3d.id.vn/vip';

export default function VipRoute() {
  const user = useAppStore((state) => state.session.user);
  const setUser = useAppStore((state) => state.setUser);
  const [plans, setPlans] = useState<VipPlan[]>([]);
  const [orders, setOrders] = useState<VipOrder[]>([]);
  const [status, setStatus] = useState<{ active: boolean; expiresAt: string | null; permanent: boolean } | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [nextPlans, history, me] = await Promise.all([
      accountApi.plans(),
      accountApi.vipHistory(),
      accountApi.me(),
    ]);
    setPlans(nextPlans);
    setOrders(history.orders);
    setStatus(history.vip);
    setUser(me);
  }, [setUser]);

  useEffect(() => {
    void load().catch((error) => setMessage(error instanceof Error ? error.message : 'Không thể tải VIP.'));
  }, [load]);

  const openWebsite = async () => {
    setBusy(true);
    setMessage('');
    try {
      const supported = await Linking.canOpenURL(VIP_WEB_URL);
      if (!supported) throw new Error('Không mở được trình duyệt trên thiết bị này.');
      await Linking.openURL(VIP_WEB_URL);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể mở trang VIP.');
    } finally {
      setBusy(false);
    }
  };

  const isVip = Boolean(status?.active || user?.isVip);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text variant="headlineSmall">CINE3D VIP</Text>

      <Card mode="contained">
        <Card.Content style={styles.gap}>
          <Text variant="titleLarge">{isVip ? 'VIP đang hoạt động' : 'Tài khoản tiêu chuẩn'}</Text>
          <Text style={styles.muted}>
            {status?.permanent
              ? 'Quyền lợi vĩnh viễn'
              : status?.expiresAt
                ? `Hết hạn ${new Date(status.expiresAt).toLocaleDateString('vi-VN')}`
                : 'Chưa có kỳ hạn VIP'}
          </Text>
        </Card.Content>
      </Card>

      <Card mode="contained">
        <Card.Content style={styles.gap}>
          <Text variant="titleMedium">Mua VIP trên website</Text>
          <Text style={styles.body}>
            App Android hiện không bán VIP trong ứng dụng. Bạn mua trên website, đăng nhập cùng tài khoản, rồi quay lại app để dùng quyền lợi VIP.
          </Text>
          <View style={styles.steps}>
            <Text style={styles.step}>1. Bấm nút bên dưới để mở trang VIP.</Text>
            <Text style={styles.step}>2. Đăng nhập cùng email đã dùng trên app.</Text>
            <Text style={styles.step}>3. Chọn gói và thanh toán trên website.</Text>
            <Text style={styles.step}>4. Quay lại app, kéo xuống để làm mới hoặc bấm “Đã mua xong”.</Text>
          </View>
          <Pressable onPress={() => void openWebsite()} accessibilityRole="link">
            <Text style={styles.link}>{VIP_WEB_URL}</Text>
          </Pressable>
          <Button mode="contained" loading={busy} disabled={busy} onPress={() => void openWebsite()}>
            Mua VIP trên website
          </Button>
          <Button mode="outlined" onPress={() => void load().catch((error) => setMessage(error.message))}>
            Đã mua xong · Làm mới trạng thái
          </Button>
        </Card.Content>
      </Card>

      <Text variant="titleLarge">Các gói hiện có</Text>
      {plans.map((plan) => (
        <Card key={plan.id}>
          <Card.Title
            title={plan.name}
            subtitle={`${plan.durationDays} ngày · ${plan.price.toLocaleString('vi-VN')} ₫`}
          />
          <Card.Content>
            <Text>{plan.description || 'Mua trên website để kích hoạt gói này.'}</Text>
          </Card.Content>
        </Card>
      ))}
      {!plans.length ? <Text style={styles.muted}>Chưa tải được danh sách gói.</Text> : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <Text variant="titleLarge">Lịch sử đơn hàng</Text>
      {orders.map((order) => (
        <Card key={order.id}>
          <Card.Title
            title={order.plan.name}
            subtitle={`${order.status} · ${order.amount.toLocaleString('vi-VN')} ₫ · ${new Date(order.createdAt).toLocaleDateString('vi-VN')}`}
          />
        </Card>
      ))}
      {!orders.length ? <Text style={styles.muted}>Chưa có đơn VIP trên máy chủ.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: spacing.md, gap: spacing.md },
  gap: { gap: spacing.sm },
  body: { color: colors.text, lineHeight: 22 },
  steps: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  step: { color: colors.text, lineHeight: 20 },
  link: { color: colors.primarySoft, textDecorationLine: 'underline' },
  muted: { color: colors.textMuted },
  message: { color: colors.primarySoft },
});
