import { useEffect, useState } from 'react';
import { AccessibilityInfo, PixelRatio } from 'react-native';
import { useAppStore } from '@/state/app-store';

export const MIN_TOUCH_TARGET = 48;

export function resolveReducedMotion(systemEnabled: boolean, userEnabled: boolean): boolean {
  return systemEnabled || userEnabled;
}

export function useAccessibilityPreferences() {
  const userReducedMotion = useAppStore((state) => state.preferences.reduceMotion);
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setSystemReducedMotion);
    void AccessibilityInfo.isReduceTransparencyEnabled?.().then(setReduceTransparency);
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReducedMotion);
    const transparency = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency,
    );
    return () => {
      motion.remove();
      transparency.remove();
    };
  }, []);

  return {
    reduceMotion: resolveReducedMotion(systemReducedMotion, userReducedMotion),
    reduceTransparency,
    fontScale: PixelRatio.getFontScale(),
  };
}

export function announce(message: string): void {
  AccessibilityInfo.announceForAccessibility(message);
}
