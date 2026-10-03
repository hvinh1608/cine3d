import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { Text } from 'react-native-paper';
import { bannerUnitId, ensureAdsInitialized } from '@/features/ads/admob';
import { isVipActive } from '@/features/ads/vip-access';
import { useAppStore } from '@/state/app-store';
import { colors, spacing } from '@/theme';

type Props = {
  style?: object;
};

/** Prefer sizes with the highest real-world fill rate first. */
const BANNER_SIZES = [
  BannerAdSize.BANNER,
  BannerAdSize.LARGE_BANNER,
  BannerAdSize.ANCHORED_ADAPTIVE_BANNER,
] as const;

const RETRY_DELAYS_MS = [1_500, 4_000, 10_000, 20_000];

/** Banner for free users. Hidden for VIP / when AdMob has no fill. */
export function AdBanner({ style }: Props) {
  const hydrated = useAppStore((state) => state.session.hydrated);
  const user = useAppStore((state) => state.session.user);
  const isVip = isVipActive(user);
  const { width: windowWidth } = useWindowDimensions();
  const [sdkReady, setSdkReady] = useState(false);
  const [sizeIndex, setSizeIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [visible, setVisible] = useState(true);
  const [armed, setArmed] = useState(true);

  const adWidth = useMemo(() => Math.max(320, Math.floor(windowWidth - spacing.md * 2)), [windowWidth]);
  const size = BANNER_SIZES[Math.min(sizeIndex, BANNER_SIZES.length - 1)] ?? BannerAdSize.BANNER;
  const usesAdaptive = size === BannerAdSize.ANCHORED_ADAPTIVE_BANNER;

  useEffect(() => {
    if (Platform.OS !== 'android' || isVip) return;
    let cancelled = false;
    void ensureAdsInitialized().then(() => {
      if (!cancelled) setSdkReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isVip]);

  useEffect(() => {
    setSizeIndex(0);
    setAttempt(0);
    setVisible(true);
    setArmed(true);
  }, [isVip]);

  if (!hydrated || isVip || Platform.OS !== 'android' || !sdkReady || !visible || !armed) {
    return null;
  }

  return (
    <View style={[styles.wrap, style]} accessibilityLabel="Quảng cáo">
      <Text style={styles.label}>Có thể bạn quan tâm</Text>
      <BannerAd
        key={`${bannerUnitId()}-${size}-${attempt}`}
        unitId={bannerUnitId()}
        size={size}
        {...(usesAdaptive ? { width: adWidth } : {})}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        onAdLoaded={() => {
          setVisible(true);
        }}
        onAdFailedToLoad={() => {
          // Try next size first — inventory often exists for BANNER but not adaptive.
          if (sizeIndex < BANNER_SIZES.length - 1) {
            setSizeIndex((prev) => prev + 1);
            setAttempt(0);
            return;
          }

          const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
          const nextAttempt = attempt + 1;
          if (nextAttempt >= RETRY_DELAYS_MS.length) {
            // No fill / unit not ready yet — hide quietly instead of a broken placeholder.
            setVisible(false);
            return;
          }

          setArmed(false);
          const timer = setTimeout(() => {
            setAttempt(nextAttempt);
            setArmed(true);
          }, delay);
          // Keep reference so StrictMode remounts don't stack timers incorrectly.
          void timer;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    width: '100%',
    gap: spacing.xs,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  label: {
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
});
