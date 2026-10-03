/** Display / update-check version for the Android APK. */
export const ANDROID_APP_VERSION = '1.0.21';

/**
 * CDN / object-storage URL for the APK binary.
 * Prefer R2 (NEXT_PUBLIC_ANDROID_APK_URL) when set; otherwise GitHub Releases
 * so downloads do not saturate the home tunnel.
 */
export const ANDROID_APK_CDN_URL =
  process.env.NEXT_PUBLIC_ANDROID_APK_URL?.trim()
  || process.env.ANDROID_APK_UPSTREAM_URL?.trim()
  || `https://github.com/hvinh1608/cine3d/releases/download/v${ANDROID_APP_VERSION}/cine3d.apk`;

/** Official download URL shown in QR codes and buttons. */
export const ANDROID_APK_URL = ANDROID_APK_CDN_URL;
