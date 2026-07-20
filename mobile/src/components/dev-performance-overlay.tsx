import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { getPerformanceQueueSize } from '@/core/performance';
import { colors, spacing } from '@/theme';

export function DevPerformanceOverlay() {
  const enabled = __DEV__ && process.env.EXPO_PUBLIC_PERF_OVERLAY === '1';
  const [queued, setQueued] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setQueued(getPerformanceQueueSize()), 1_000);
    return () => clearInterval(timer);
  }, [enabled]);
  if (!enabled) return null;
  return (
    <View pointerEvents="none" accessibilityElementsHidden style={styles.overlay}>
      <Text variant="labelSmall">DEV PERF · queued {queued}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    zIndex: 10_000,
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
});
