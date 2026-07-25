import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { PasswordInput } from '@/components/password-input';
import { ApiError } from '@/domain/models';
import { tokenStorage } from '@/data/auth/token-storage';
import { accountApi, type AuthSession } from '@/features/account/data/account-api';
import { OAuthButtons } from '@/features/account/presentation/oauth-buttons';
import { validateAuthForm, validateEmail, validatePassword } from '@/features/account/domain/validation';
import { useAppStore } from '@/state/app-store';
import { colors, radius, spacing } from '@/theme';

type Mode = 'login' | 'register' | 'forgot' | 'reset' | 'verify';

function authError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'NATIVE_ATTESTATION_MISMATCH' || error.code === 'NATIVE_ATTESTATION_REQUIRED') {
      return error.message;
    }
    if (error.code === 'TURNSTILE_REQUIRED' || /Cloudflare|xác minh|attestation/i.test(error.message)) {
      return 'Máy chủ đang chặn đăng nhập native (Cloudflare/Turnstile). Cần deploy backend mới và đặt MOBILE_APP_ATTESTATION_TOKEN trùng với app.';
    }
  }
  return error instanceof Error ? error.message : 'Không thể hoàn tất yêu cầu.';
}

export default function AuthRoute() {
  const params = useLocalSearchParams<{ resetToken?: string; verificationToken?: string }>();
  const initial = params.resetToken ? 'reset' : params.verificationToken ? 'verify' : 'login';
  const [mode, setMode] = useState<Mode>(initial);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const setSession = useAppStore((state) => state.setSession);

  useEffect(() => {
    void tokenStorage.getRememberedEmail().then((savedEmail) => {
      if (savedEmail) setEmail(savedEmail);
    });
  }, []);

  const complete = useCallback(async (session: AuthSession) => {
    if (!session.accessToken || !session.refreshToken || !session.user) throw new Error('Máy chủ không trả về native refresh token.');
    await tokenStorage.saveRememberedEmail(session.user.email);
    await setSession({ accessToken: session.accessToken, refreshToken: session.refreshToken }, session.user);
    router.replace('/(tabs)/account');
  }, [setSession]);

  const submit = async () => {
    setMessage('');
    if (mode === 'forgot') {
      const issue = validateEmail(email);
      if (issue) return setErrors({ email: issue });
    } else if (mode === 'reset') {
      const issue = validatePassword(password);
      if (issue || password !== confirmPassword) return setErrors({ password: issue, confirmPassword: password !== confirmPassword ? 'Mật khẩu xác nhận không khớp.' : undefined });
    } else if (mode !== 'verify') {
      const issues = validateAuthForm({ email, password, ...(mode === 'register' ? { username, confirmPassword } : {}) });
      setErrors(issues);
      if (Object.keys(issues).length) return;
    }
    setBusy(true);
    try {
      if (mode === 'login') await complete(await accountApi.login(email, password));
      if (mode === 'register') {
        const result = await accountApi.register(email, username, password);
        if (result.requiresVerification) setMessage(result.message || 'Hãy kiểm tra email để xác nhận tài khoản.');
        else await complete(result);
      }
      if (mode === 'forgot') setMessage((await accountApi.forgotPassword(email)).message);
      if (mode === 'reset') {
        setMessage((await accountApi.resetPassword(params.resetToken || '', password)).message);
        setMode('login');
      }
      if (mode === 'verify') {
        setMessage((await accountApi.verifyEmail(params.verificationToken || '')).message);
        setMode('login');
      }
    } catch (error) { setMessage(authError(error)); } finally { setBusy(false); }
  };

  const title = useMemo(() => ({
    login: 'Đăng nhập CINE3D', register: 'Tạo tài khoản', forgot: 'Khôi phục mật khẩu',
    reset: 'Đặt lại mật khẩu', verify: 'Xác nhận email',
  })[mode], [mode]);

  return (
    <ScrollView testID="auth-screen" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
      <View style={styles.card}>
        <Text variant="headlineMedium">{title}</Text>
        {mode === 'login' || mode === 'register' ? (
          <SegmentedButtons value={mode} onValueChange={(value) => setMode(value as Mode)} buttons={[
            { value: 'login', label: 'Đăng nhập' }, { value: 'register', label: 'Đăng ký' },
          ]} />
        ) : null}
        {mode !== 'reset' && mode !== 'verify' ? <TextInput testID="auth-email" label="Email" value={email} autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} error={Boolean(errors.email)} /> : null}
        {errors.email ? <Text style={styles.error}>{errors.email}</Text> : null}
        {mode === 'register' ? <TextInput label="Tên hiển thị" value={username} onChangeText={setUsername} error={Boolean(errors.username)} /> : null}
        {errors.username ? <Text style={styles.error}>{errors.username}</Text> : null}
        {mode === 'login' || mode === 'register' || mode === 'reset' ? <PasswordInput testID="auth-password" label="Mật khẩu" value={password} onChangeText={setPassword} error={Boolean(errors.password)} /> : null}
        {errors.password ? <Text style={styles.error}>{errors.password}</Text> : null}
        {mode === 'register' || mode === 'reset' ? <PasswordInput label="Nhập lại mật khẩu" value={confirmPassword} onChangeText={setConfirmPassword} error={Boolean(errors.confirmPassword)} /> : null}
        {errors.confirmPassword ? <Text style={styles.error}>{errors.confirmPassword}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <Button testID="auth-submit" mode="contained" loading={busy} disabled={busy} onPress={() => void submit()}>{title}</Button>
        {mode === 'login' ? <Button onPress={() => setMode('forgot')}>Quên mật khẩu?</Button> : null}
        {mode === 'forgot' ? <Button onPress={() => setMode('login')}>Quay lại đăng nhập</Button> : null}
        {mode === 'login' || mode === 'register' ? <OAuthButtons onSession={complete} onError={setMessage} /> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', padding: spacing.md, backgroundColor: colors.background },
  card: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface },
  error: { color: colors.primarySoft },
  message: { color: colors.warning },
});
