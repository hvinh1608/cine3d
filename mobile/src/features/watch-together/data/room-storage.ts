import * as SecureStore from 'expo-secure-store';

const ACTIVE_ROOM_KEY = 'cine3d.watch-room.active.v1';
const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export interface SavedRoomSession {
  roomId: string;
  displayName: string;
  roomAccessToken?: string;
}

function validSession(value: unknown): value is SavedRoomSession {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<SavedRoomSession>;
  return typeof item.roomId === 'string'
    && item.roomId.length > 0
    && typeof item.displayName === 'string'
    && (!item.roomAccessToken || typeof item.roomAccessToken === 'string');
}

export const roomStorage = {
  async load(): Promise<SavedRoomSession | null> {
    const raw = await SecureStore.getItemAsync(ACTIVE_ROOM_KEY, secureOptions);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return validSession(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },
  async save(session: SavedRoomSession): Promise<void> {
    await SecureStore.setItemAsync(ACTIVE_ROOM_KEY, JSON.stringify(session), secureOptions);
  },
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(ACTIVE_ROOM_KEY, secureOptions);
  },
};
