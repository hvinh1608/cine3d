import { tokenStorage } from '@/data/auth/token-storage';
import { accountApi } from '@/features/account/data/account-api';
import { useAppStore } from '@/state/app-store';

/** Load profiles and restore/select an active viewer profile for history sync. */
export async function ensureActiveProfile() {
  const state = useAppStore.getState();
  if (!state.session.tokens.refreshToken) return;
  try {
    const [profiles, savedProfileId] = await Promise.all([
      accountApi.profiles(),
      tokenStorage.getActiveProfileId(),
    ]);
    if (!profiles.length) {
      useAppStore.getState().setActiveProfile(null);
      return;
    }
    const preferred = profiles.find((item) => item.id === savedProfileId)
      || profiles.find((item) => item.id === state.session.activeProfile?.id)
      || profiles[0]
      || null;
    useAppStore.getState().setActiveProfile(preferred);
  } catch {
    // Keep existing profile when offline.
  }
}
