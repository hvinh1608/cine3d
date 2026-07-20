import * as SecureStore from 'expo-secure-store';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface KeyValueStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

const ACCESS_TOKEN_KEY = 'cine3d.auth.access';
const REFRESH_TOKEN_KEY = 'cine3d.auth.refresh';
const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export class TokenStorage {
  constructor(private readonly storage: KeyValueStorage = SecureStore) {}

  async getTokens(): Promise<Partial<AuthTokens>> {
    const [accessToken, refreshToken] = await Promise.all([
      this.storage.getItemAsync(ACCESS_TOKEN_KEY),
      this.storage.getItemAsync(REFRESH_TOKEN_KEY),
    ]);
    return {
      ...(accessToken ? { accessToken } : {}),
      ...(refreshToken ? { refreshToken } : {}),
    };
  }

  async saveTokens(tokens: AuthTokens): Promise<void> {
    await Promise.all([
      this.storage.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
      this.storage.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
    ]);
  }

  async updateAccessToken(accessToken: string): Promise<void> {
    await this.storage.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  }

  async clear(): Promise<void> {
    const results = await Promise.allSettled([
      this.storage.deleteItemAsync(ACCESS_TOKEN_KEY),
      this.storage.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]);
    const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failure) throw failure.reason;
  }
}

export const tokenStorage = new TokenStorage({
  getItemAsync: (key) => SecureStore.getItemAsync(key, secureOptions),
  setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, secureOptions),
  deleteItemAsync: (key) => SecureStore.deleteItemAsync(key, secureOptions),
});
