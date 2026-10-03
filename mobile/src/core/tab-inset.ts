import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/theme';

/** Must match tabBarStyle.height in app/(tabs)/_layout.tsx */
export const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 70;

/** Bottom padding so scroll content clears the absolute tab bar + gesture inset. */
export function useTabScreenBottomPadding(extra: number = spacing.lg) {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + insets.bottom + extra;
}
