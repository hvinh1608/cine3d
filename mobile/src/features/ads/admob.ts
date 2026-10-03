import { Platform } from 'react-native';
import mobileAds, { TestIds } from 'react-native-google-mobile-ads';

let adsInitialized: Promise<void> | null = null;

/** Warm up AdMob once per app process (Android release builds). */
export function ensureAdsInitialized() {
  if (Platform.OS !== 'android') return Promise.resolve();
  if (!adsInitialized) {
    adsInitialized = mobileAds()
      .setRequestConfiguration({
        // Helps AdMob serve ads while the account/app is still warming up.
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
      })
      .then(() => mobileAds().initialize())
      .then(() => undefined)
      .catch(() => undefined);
  }
  return adsInitialized;
}

/** AdMob App ID — must match app.json plugin / react-native-google-mobile-ads block. */
export const ADMOB_ANDROID_APP_ID = 'ca-app-pub-4393110640744475~9656274330';

/** Production banner unit from AdMob console. */
export const ADMOB_BANNER_UNIT_ID = 'ca-app-pub-4393110640744475/6455395928';

/** Google sample banner — only used in __DEV__ to avoid accidental invalid traffic. */
export function bannerUnitId() {
  if (__DEV__) return TestIds.BANNER;
  if (Platform.OS === 'android') return ADMOB_BANNER_UNIT_ID;
  return TestIds.BANNER;
}
