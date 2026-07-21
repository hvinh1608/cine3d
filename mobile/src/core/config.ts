const DEFAULT_API_URL = 'https://api.cine3d.id.vn/api';
const DEFAULT_GOOGLE_CLIENT_ID = '351178371430-1bum195duljbh950btqqvk8c2tamjcb6.apps.googleusercontent.com';

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export const config = Object.freeze({
  apiUrl: normalizeUrl(process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL),
  appAttestation: process.env.EXPO_PUBLIC_APP_ATTESTATION_TOKEN?.trim() || '',
  googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID?.trim() || DEFAULT_GOOGLE_CLIENT_ID,
  firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim() || '',
  googlePlayProducts: String(process.env.EXPO_PUBLIC_GOOGLE_PLAY_PRODUCT_IDS || '')
    .split(',')
    .map((value: string) => value.trim())
    .filter(Boolean),
  requestTimeoutMs: 15_000,
  queryStaleTimeMs: 5 * 60_000,
  queryGcTimeMs: 45 * 60_000,
});

export { DEFAULT_API_URL, DEFAULT_GOOGLE_CLIENT_ID, normalizeUrl };
