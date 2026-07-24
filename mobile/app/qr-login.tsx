import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Text, TextInput } from 'react-native-paper';
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
  const initial = extractToken(params.t || params.token || '');
  const [tokenInput, setTokenInput] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const hydrated = useAppStore((state) => state.session.hydrated);
  const refreshToken = useAppStore((state) => state.session.tokens.refreshToken);
  const user = useAppStore((state) => state.session.user);

  useEffect(() => {
    if (initial) setTokenInput(initial);
  }, [initial]);

  const token = useMemo(() => extractToken(tokenInput), [tokenInput]);

  const approve = useCallback(async () => {
    setError('');
    setMessage('');
    if (!token || token.length < 32) {
      setError('Mã QR không hợp lệ. Hãy quét lại mã trên web.');
      return;
    }
    if (!refreshToken) {
      setError('Hãy đăng nhập app trước, rồi mở lại liên kết QR.');
      router.push('/account/auth');
      return;
    }
    setBusy(true);
    try {
      const result = await accountApi.approveQrLogin(token);
      setMessage(result.message || 'Đã xác nhận đăng nhập web.');
    } catch (caught) {
      setError(caught instanceof ApiError || caught instanceof Error ? caught.message : 'Không thể xác nhận mã QR.');
    } finally {
      setBusy(false);
    }
  }, [refreshToken, token]);

  useEffect(() => {
    if (!hydrated || !initial || !refreshToken) return;
    void approve();
  }, [approve, hydrated, initial, refreshToken]);

  if (!hydrated) {
    return <View style={styles.center}><Text>Đang khôi phục phiên…</Text></View>;
  }

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text variant="headlineSmall">Đăng nhập web bằng QR</Text>
        <Text style={styles.muted}>
          {user
            ? `Xác nhận đăng nhập web cho tài khoản ${user.username}.`
            : 'Đăng nhập app trước để phê duyệt phiên web.'}
        </Text>
        {!initial ? (
          <TextInput
            mode="outlined"
            label="Dán mã / link QR"
            value={tokenInput}
            onChangeText={setTokenInput}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}
        <Button mode="contained" loading={busy} disabled={busy} onPress={() => void approve()}>
          Xác nhận đăng nhập web
        </Button>
        {!refreshToken ? (
          <Button mode="outlined" onPress={() => router.push('/account/auth')}>Đăng nhập app</Button>
        ) : null}
        <Button onPress={() => router.replace('/(tabs)/account')}>Về tài khoản</Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { gap: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, padding: spacing.lg },
  muted: { color: colors.textMuted, lineHeight: 20 },
  input: { backgroundColor: colors.surface },
  error: { color: colors.primarySoft },
  success: { color: '#34d399' },
});
