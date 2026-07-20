import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Text, TextInput } from 'react-native-paper';
import { accountApi } from '@/features/account/data/account-api';
import { useAppStore } from '@/state/app-store';
import { colors, spacing } from '@/theme';

const documents = {
  terms: {
    title: 'Điều khoản dịch vụ',
    sections: [
      ['Chấp nhận điều khoản', 'Khi sử dụng CINE3D, bạn đồng ý cung cấp thông tin chính xác, bảo vệ thông tin đăng nhập và tuân thủ pháp luật hiện hành.'],
      ['Tài khoản', 'Bạn chịu trách nhiệm cho hoạt động trên tài khoản. CINE3D có thể tạm khóa tài khoản có dấu hiệu gian lận, lạm dụng hoặc gây ảnh hưởng đến hệ thống và người dùng khác.'],
      ['Dịch vụ', 'Tính năng và nội dung có thể được cập nhật, gián đoạn hoặc thay đổi để bảo trì, bảo mật và nâng cao chất lượng. Không được phát tán mã độc hoặc truy cập trái phép.'],
      ['Liên hệ', 'Câu hỏi về điều khoản có thể gửi tới hvinh.job@gmail.com.'],
    ],
  },
  privacy: {
    title: 'Chính sách quyền riêng tư',
    sections: [
      ['Dữ liệu chúng tôi thu thập', 'CINE3D lưu email, tên hiển thị, ảnh đại diện, mã định danh đăng nhập, lịch sử xem, danh sách yêu thích và dữ liệu kỹ thuật cần thiết để bảo mật phiên.'],
      ['Mục đích sử dụng', 'Dữ liệu dùng để bảo vệ tài khoản, đồng bộ trải nghiệm, hỗ trợ người dùng và cải thiện dịch vụ. CINE3D không bán thông tin cá nhân.'],
      ['Đăng nhập Google', 'CINE3D chỉ yêu cầu hồ sơ công khai và email bạn đồng ý chia sẻ. Bạn có thể thu hồi quyền trong cài đặt tài khoản Google.'],
      ['Quyền của bạn', 'Bạn có thể xóa tài khoản trong ứng dụng hoặc yêu cầu hỗ trợ qua hvinh.job@gmail.com.'],
    ],
  },
  'data-deletion': {
    title: 'Xóa tài khoản và dữ liệu',
    sections: [
      ['Xóa trong ứng dụng', 'Tài khoản đã đăng nhập có thể tự xóa ngay bên dưới. Hành động này xóa hồ sơ, lịch sử xem, yêu thích, danh sách, bình luận, thiết bị FCM và dữ liệu cá nhân liên quan.'],
      ['Dữ liệu được giữ lại', 'Hồ sơ thanh toán/VIP và bản ghi bắt buộc theo pháp lý hoặc chống gian lận có thể được giữ trong thời hạn cần thiết. Bạn cũng có thể thu hồi quyền CINE3D trong cài đặt Google.'],
      ['Trang công khai', 'Yêu cầu xóa không đăng nhập: https://cine3d.id.vn/data-deletion'],
    ],
  },
} as const;

export default function LegalDocumentRoute() {
  const router = useRouter();
  const { document } = useLocalSearchParams<{ document: keyof typeof documents }>();
  const value = documents[document] || documents.privacy;
  const user = useAppStore((state) => state.session.user);
  const logout = useAppStore((state) => state.logout);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const confirmDelete = () => {
    if (!user) {
      setMessage('Đăng nhập để xóa tài khoản trong ứng dụng, hoặc dùng trang https://cine3d.id.vn/data-deletion.');
      return;
    }
    Alert.alert(
      'Xóa tài khoản vĩnh viễn?',
      'Không thể hoàn tác. Toàn bộ dữ liệu cá nhân liên quan sẽ bị xóa.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa ngay',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              setMessage('');
              try {
                const result = await accountApi.deleteAccount({
                  confirmation: 'DELETE_MY_ACCOUNT',
                  password: password.trim() || undefined,
                });
                await logout();
                setMessage(result.message);
                router.replace('/(tabs)/account');
              } catch (error) {
                setMessage(error instanceof Error ? error.message : 'Không thể xóa tài khoản.');
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text variant="headlineSmall">{value.title}</Text>
      <Text style={styles.muted}>Cập nhật ngày 18/07/2026</Text>
      {value.sections.map(([title, content]) => (
        <Text key={title}>
          <Text variant="titleMedium">{title}{'\n'}</Text>
          {content}
        </Text>
      ))}
      {document === 'data-deletion' ? (
        <View style={styles.deleteBox}>
          {user ? (
            <>
              <TextInput
                mode="outlined"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                label="Mật khẩu (bắt buộc với tài khoản email/password)"
                accessibilityLabel="Mật khẩu xác nhận xóa tài khoản"
              />
              <Button mode="contained" loading={busy} disabled={busy} onPress={confirmDelete} buttonColor={colors.primary}>
                Xóa tài khoản và dữ liệu
              </Button>
            </>
          ) : (
            <Button mode="contained" onPress={() => router.push('/account/auth')}>
              Đăng nhập để xóa tài khoản
            </Button>
          )}
        </View>
      ) : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: spacing.lg, gap: spacing.lg },
  muted: { color: colors.textMuted },
  message: { color: colors.warning },
  deleteBox: { gap: spacing.md },
});
