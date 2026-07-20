import * as SecureStore from 'expo-secure-store';
import { defaultPreferences, normalizePreferences, settingsStorage } from './settings-storage';

describe('settings storage', () => {
  beforeEach(() => jest.clearAllMocks());
  it('normalizes unsupported persisted values', () => {
    expect(normalizePreferences({ language: 'fr', subtitleSize: 500, streamingQuality: '4k' })).toMatchObject({
      language: 'vi', subtitleSize: 160, streamingQuality: 'auto',
    });
  });
  it('returns defaults for corrupt storage', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('{bad');
    await expect(settingsStorage.load()).resolves.toEqual(defaultPreferences);
  });
});
