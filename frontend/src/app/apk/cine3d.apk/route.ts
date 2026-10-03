import { NextResponse } from 'next/server';
import { ANDROID_APK_CDN_URL, ANDROID_APP_VERSION } from '@/lib/android-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Always redirect to CDN (GitHub Releases or R2).
 * Serving ~150MB from the home tunnel was slow and saturated bandwidth.
 * Set ANDROID_APK_SERVE_LOCAL=true only for offline/dev testing.
 */
export async function GET() {
  const target = ANDROID_APK_CDN_URL;
  const response = NextResponse.redirect(target, 302);
  response.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  response.headers.set('X-Cine3D-App-Version', ANDROID_APP_VERSION);
  response.headers.set('X-Cine3D-Apk-Source', 'cdn-redirect');
  return response;
}
