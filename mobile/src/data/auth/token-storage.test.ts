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

  it('stores, reads and clears cached user snapshot', async () => {
    const storage = new TokenStorage(memoryStorage());
    const user = {
      id: '1',
      email: 'user@cine3d.test',
      username: 'user',
      role: 'USER',
      isVip: false,
    };

    await storage.saveUser(user);
    await expect(storage.getUser()).resolves.toEqual(user);
    await storage.clear();
    await expect(storage.getUser()).resolves.toBeNull();
  });

  it('remembers the last login email across session clears', async () => {
    const storage = new TokenStorage(memoryStorage());
    await storage.saveRememberedEmail('User@Cine3D.test');
    await storage.clear();

    await expect(storage.getRememberedEmail()).resolves.toBe('user@cine3d.test');
  });
});
