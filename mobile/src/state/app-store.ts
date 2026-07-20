import { create } from 'zustand';
import type { AuthTokens } from '@/data/auth/token-storage';
import { tokenStorage } from '@/data/auth/token-storage';
import type { Profile, User } from '@/domain/models';
import { defaultPreferences, settingsStorage, type AppPreferences } from '@/features/account/data/settings-storage';

interface SessionState {
  hydrated: boolean;
  tokens: Partial<AuthTokens>;
  user: User | null;
  activeProfile: Profile | null;
}

interface AppStore {
  session: SessionState;
  preferences: AppPreferences;
  hydrateSession(): Promise<void>;
  setSession(tokens: AuthTokens, user: User): Promise<void>;
  updateAccessToken(accessToken: string): Promise<void>;
  setActiveProfile(profile: Profile | null): void;
  setUser(user: User): void;
  setPreference<K extends keyof AppPreferences>(key: K, value: AppPreferences[K]): Promise<void>;
  logout(): Promise<void>;
}

const initialSession: SessionState = {
  hydrated: false,
  tokens: {},
  user: null,
  activeProfile: null,
};

export const useAppStore = create<AppStore>((set) => ({
  session: initialSession,
  preferences: defaultPreferences,
  hydrateSession: async () => {
    try {
      const [tokens, preferences] = await Promise.all([tokenStorage.getTokens(), settingsStorage.load()]);
      set((state) => ({ preferences, session: { ...state.session, tokens, hydrated: true } }));
    } catch {
      set((state) => ({ session: { ...state.session, tokens: {}, hydrated: true } }));
    }
  },
  setSession: async (tokens, user) => {
    await tokenStorage.saveTokens(tokens);
    set((state) => ({ session: { ...state.session, tokens, user, hydrated: true } }));
  },
  updateAccessToken: async (accessToken) => {
    await tokenStorage.updateAccessToken(accessToken);
    set((state) => ({
      session: { ...state.session, tokens: { ...state.session.tokens, accessToken } },
    }));
  },
  setActiveProfile: (activeProfile) => {
    set((state) => ({ session: { ...state.session, activeProfile } }));
  },
  setUser: (user) => set((state) => ({ session: { ...state.session, user } })),
  setPreference: async (key, value) => {
    const next = { ...useAppStore.getState().preferences, [key]: value };
    set({ preferences: next });
    await settingsStorage.save(next);
  },
  logout: async () => {
    try {
      await tokenStorage.clear();
    } finally {
      set({ session: { ...initialSession, hydrated: true } });
    }
  },
}));
