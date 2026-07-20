import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Button, Text } from 'react-native-paper';
import { useAppStore } from '@/state/app-store';
import { colors, spacing } from '@/theme';

export async function authenticateAppLock(): Promise<boolean> {
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) return false;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Mở khóa CINE3D',
    cancelLabel: 'Hủy',
    fallbackLabel: 'Dùng mã khóa thiết bị',
    disableDeviceFallback: false,
  });
  return result.success;
}

export function AppLock({ children }: PropsWithChildren) {
  const enabled = useAppStore((state) => state.preferences.biometricLock);
  const hydrated = useAppStore((state) => state.session.hydrated);
  const [locked, setLocked] = useState(false);
  const state = useRef(AppState.currentState);
  const unlock = useCallback(async () => setLocked(!(await authenticateAppLock())), []);

  useEffect(() => {
    if (hydrated && enabled) {
      setLocked(true);
      void unlock();
    } else if (!enabled) setLocked(false);
  }, [enabled, hydrated, unlock]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (enabled && state.current === 'active' && /inactive|background/.test(next)) setLocked(true);
      if (enabled && /inactive|background/.test(state.current) && next === 'active') void unlock();
      state.current = next;
    });
    return () => subscription.remove();
  }, [enabled, unlock]);

  if (!locked) return <>{children}</>;
  return (
    <View style={styles.page}>
      <Text variant="headlineMedium">CINE3D đã khóa</Text>
      <Text style={styles.muted}>Xác thực sinh trắc học hoặc mã khóa thiết bị để tiếp tục.</Text>
      <Button mode="contained" onPress={() => void unlock()}>Mở khóa</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.background },
  muted: { color: colors.textMuted, textAlign: 'center' },
});
