import * as SecureStore from 'expo-secure-store';

const KEY = 'cine3d.preferences.v2';

export type ThemeMode = 'system' | 'dark';
export type AppLanguage = 'vi' | 'en';
export type StreamingQuality = 'auto' | '720p' | '1080p';
export type DownloadQuality = '720p' | '1080p';

export interface AppPreferences {
  theme: ThemeMode;
  language: AppLanguage;
  autoplay: boolean;
  dataSaver: boolean;
  streamingQuality: StreamingQuality;
  subtitlesEnabled: boolean;
  subtitleLanguage: AppLanguage;
  subtitleSize: number;
  downloadQuality: DownloadQuality;
  reduceMotion: boolean;
  biometricLock: boolean;
  notificationsEnabled: boolean;
}

export const defaultPreferences: AppPreferences = {
  theme: 'system',
  language: 'vi',
  autoplay: true,
  dataSaver: false,
  streamingQuality: 'auto',
  subtitlesEnabled: true,
  subtitleLanguage: 'vi',
  subtitleSize: 100,
  downloadQuality: '720p',
  reduceMotion: false,
  biometricLock: false,
  notificationsEnabled: true,
};

export function normalizePreferences(value: unknown): AppPreferences {
  if (!value || typeof value !== 'object') return defaultPreferences;
  const source = value as Partial<AppPreferences>;
  return {
    ...defaultPreferences,
    ...source,
    theme: source.theme === 'dark' ? 'dark' : 'system',
    language: source.language === 'en' ? 'en' : 'vi',
    streamingQuality: ['auto', '720p', '1080p'].includes(source.streamingQuality || '') ? source.streamingQuality! : 'auto',
    downloadQuality: source.downloadQuality === '1080p' ? '1080p' : '720p',
    subtitleLanguage: source.subtitleLanguage === 'en' ? 'en' : 'vi',
    subtitleSize: Math.min(160, Math.max(75, Number(source.subtitleSize) || 100)),
  };
}

export const settingsStorage = {
  async load(): Promise<AppPreferences> {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return defaultPreferences;
    try { return normalizePreferences(JSON.parse(raw)); } catch { return defaultPreferences; }
  },
  async save(value: AppPreferences) {
    await SecureStore.setItemAsync(KEY, JSON.stringify(normalizePreferences(value)), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
};
