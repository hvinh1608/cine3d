import { TokenStorage, type KeyValueStorage } from '@/data/auth/token-storage';

function memoryStorage(): KeyValueStorage {
  const values = new Map<string, string>();
  return {
    getItemAsync: async (key) => values.get(key) ?? null,
    setItemAsync: async (key, value) => { values.set(key, value); },
    deleteItemAsync: async (key) => { values.delete(key); },
  };
}

describe('TokenStorage', () => {
  it('stores, reads and clears both session tokens', async () => {
    const storage = new TokenStorage(memoryStorage());
    await storage.saveTokens({ accessToken: 'access', refreshToken: 'refresh' });

    await expect(storage.getTokens()).resolves.toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    await storage.clear();
    await expect(storage.getTokens()).resolves.toEqual({});
  });

  it('updates the access token without replacing refresh token', async () => {
    const storage = new TokenStorage(memoryStorage());
    await storage.saveTokens({ accessToken: 'old', refreshToken: 'refresh' });
    await storage.updateAccessToken('new');

    await expect(storage.getTokens()).resolves.toEqual({
      accessToken: 'new',
      refreshToken: 'refresh',
    });
  });
});
