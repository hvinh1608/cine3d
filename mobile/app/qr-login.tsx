import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Button, Text } from 'react-native-paper';
import { ApiError } from '@/domain/models';
import { accountApi } from '@/features/account/data/account-api';
import { useAppStore } from '@/state/app-store';
import { colors, radius, spacing } from '@/theme';

function extractToken(raw: string) {
  const value = raw.trim();
  if (!value) return '';
  const fromQuery = value.match(/[?&](?:t|token)=([^&#]+)/i);
  if (fromQuery?.[1]) {
    try {
      return decodeURIComponent(fromQuery[1]).trim();
    } catch {
      return fromQuery[1].trim();
    }
  }
  return value.replace(/^<|>$/g, '').trim();
}

export default function QrLoginRoute() {
  const params = useLocalSearchParams<{ t?: string; token?: string }>();
  const deepLinkToken = extractToken(params.t || params.token || '');
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [scannedToken, setScannedToken] = useState(deepLinkToken);
  const lockRef = useRef(false);
  const hydrated = useAppStore((state) => state.session.hydrated);
  const refreshToken = useAppStore((state) => state.session.tokens.refreshToken);
  const user = useAppStore((state) => state.session.user);

  useEffect(() => {
    if (deepLinkToken) setScannedToken(deepLinkToken);
  }, [deepLinkToken]);

  const approve = useCallback(async (token: string) => {
    setError('');
    setMessage('');
    if (!token || token.length < 32) {
      setError('Mã QR không hợp lệ. Hãy quét lại mã trên web.');
      lockRef.current = false;
      setScannedToken('');
      return;
    }
    if (!refreshToken) {
      setError('Hãy đăng nhập app trước, rồi quét lại mã QR.');
      router.push('/account/auth');
      return;
    }
    setBusy(true);
    try {
      const result = await accountApi.approveQrLogin(token);
      setMessage(result.message || 'Đã xác nhận đăng nhập web.');
    } catch (caught) {
      setError(caught instanceof ApiError || caught instanceof Error ? caught.message : 'Không thể xác nhận mã QR.');
      lockRef.current = false;
      setScannedToken('');
    } finally {
      setBusy(false);
    }
  }, [refreshToken]);

  useEffect(() => {
    if (!hydrated || !scannedToken || !refreshToken || busy || message) return;
    void approve(scannedToken);
  }, [approve, busy, hydrated, message, refreshToken, scannedToken]);

  const onBarcodeScanned = useCallback((result: BarcodeScanningResult) => {
    if (lockRef.current || busy || message) return;
    const token = extractToken(result.data || '');
    if (!token || token.length < 32) return;
    lockRef.current = true;
    setScannedToken(token);
  }, [busy, message]);

  const resetScan = useCallback(() => {
    lockRef.current = false;
    setScannedToken('');
    setError('');
    setMessage('');
  }, []);

  if (!hydrated) {
    return <View style={styles.center}><Text>Đang khôi phục phiên…</Text></View>;
  }

  if (!refreshToken) {
    return (
      <View style={styles.page}>
        <View style={styles.card}>
          <Text variant="headlineSmall">Đăng nhập web bằng QR</Text>
          <Text style={styles.muted}>Đăng nhập app trước để quét mã và phê duyệt phiên trên máy tính.</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button mode="contained" onPress={() => router.push('/account/auth')}>Đăng nhập app</Button>
          <Button onPress={() => router.replace('/(tabs)/account')}>Về tài khoản</Button>
        </View>
      </View>
    );
  }

  if (message) {
    return (
      <View style={styles.page}>
        <View style={styles.card}>
          <Text variant="headlineSmall">Thành công</Text>
          <Text style={styles.success}>{message}</Text>
          <Text style={styles.muted}>
            {user ? `Đã đăng nhập web bằng tài khoản ${user.username}.` : 'Phiên web đã được xác nhận.'}
          </Text>
          <Button mode="contained" onPress={() => router.replace('/(tabs)/account')}>Về tài khoản</Button>
        </View>
      </View>
    );
  }

  if (!permission) {
    return <View style={styles.center}><Text>Đang kiểm tra quyền camera…</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.page}>
        <View style={styles.card}>
          <Text variant="headlineSmall">Cần quyền camera</Text>
          <Text style={styles.muted}>Cho phép camera để quét mã QR đăng nhập trên web.</Text>
          <Button mode="contained" onPress={() => void requestPermission()}>Cho phép camera</Button>
          <Button onPress={() => router.replace('/(tabs)/account')}>Hủy</Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.scannerPage}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scannedToken || busy ? undefined : onBarcodeScanned}
      />
      <View style={styles.overlay}>
        <Text variant="titleMedium" style={styles.overlayTitle}>Quét mã QR trên web</Text>
        <Text style={styles.overlayHint}>Đưa camera vào mã QR ở trang đăng nhập máy tính</Text>
        <View style={styles.frame} />
        {busy ? <Text style={styles.overlayStatus}>Đang xác nhận…</Text> : null}
        {error ? <Text style={styles.overlayError}>{error}</Text> : null}
        <View style={styles.actions}>
          {error ? <Button mode="contained" onPress={resetScan}>Quét lại</Button> : null}
          <Button mode="outlined" textColor="#fff" onPress={() => router.replace('/(tabs)/account')}>Đóng</Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  card: { gap: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, padding: spacing.lg },
  muted: { color: colors.textMuted, lineHeight: 20 },
  error: { color: colors.primarySoft },
  success: { color: '#34d399' },
  scannerPage: { flex: 1, backgroundColor: '#000' },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  overlayTitle: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  overlayHint: { color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: spacing.sm },
  frame: {
    width: 240,
    height: 240,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'transparent',
  },
  overlayStatus: { color: '#fbbf24', fontWeight: '700' },
  overlayError: { color: '#fca5a5', textAlign: 'center' },
  actions: { width: '100%', gap: spacing.sm },
});
