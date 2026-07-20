export const WATCH_REACTIONS = ['❤️', '😂', '😮', '👏', '🔥', '😢'] as const;
export type WatchReactionEmoji = (typeof WATCH_REACTIONS)[number];

export interface RoomPlaybackState {
  playing: boolean;
  currentTime: number;
  updatedAt: number;
}

export interface RoomUser {
  id: string;
  name: string;
}

export interface PublicRoom {
  id: string;
  slug: string;
  episode: number;
  hostName: string;
  viewerCount: number;
  playing: boolean;
  isPrivate: boolean;
  createdAt: number;
}

export interface JoinedRoom {
  roomId: string;
  slug: string;
  episode: number;
  hostId: string;
  users: RoomUser[];
  isPrivate: boolean;
  state: RoomPlaybackState;
  roomAccessToken?: string;
}

export interface RoomMessage {
  id: string;
  name: string;
  message: string;
  createdAt: number;
}

export interface RoomReaction {
  id: string;
  emoji: WatchReactionEmoji;
  name: string;
  createdAt: number;
}

export interface ActiveRoomState {
  room: JoinedRoom | null;
  messages: RoomMessage[];
  reactions: RoomReaction[];
  endedReason: string | null;
}

export type RoomAction =
  | { type: 'joined'; room: JoinedRoom }
  | { type: 'users'; users: RoomUser[]; hostId: string; episode: number; isPrivate: boolean }
  | { type: 'playback'; state: RoomPlaybackState }
  | { type: 'episode'; episode: number; state: RoomPlaybackState }
  | { type: 'message'; message: RoomMessage }
  | { type: 'reaction'; reaction: RoomReaction }
  | { type: 'expire-reaction'; id: string }
  | { type: 'ended'; reason: string }
  | { type: 'clear' };

export const initialActiveRoomState: ActiveRoomState = {
  room: null,
  messages: [],
  reactions: [],
  endedReason: null,
};

export function roomReducer(state: ActiveRoomState, action: RoomAction): ActiveRoomState {
  switch (action.type) {
    case 'joined':
      return { ...initialActiveRoomState, room: action.room };
    case 'users':
      return state.room ? {
        ...state,
        room: {
          ...state.room,
          users: action.users,
          hostId: action.hostId,
          episode: action.episode,
          isPrivate: action.isPrivate,
        },
      } : state;
    case 'playback':
      return state.room ? { ...state, room: { ...state.room, state: action.state } } : state;
    case 'episode':
      return state.room ? {
        ...state,
        room: { ...state.room, episode: action.episode, state: action.state },
      } : state;
    case 'message':
      return { ...state, messages: [...state.messages, action.message].slice(-300) };
    case 'reaction':
      return { ...state, reactions: [...state.reactions, action.reaction].slice(-12) };
    case 'expire-reaction':
      return { ...state, reactions: state.reactions.filter((item) => item.id !== action.id) };
    case 'ended':
      return { ...initialActiveRoomState, endedReason: action.reason };
    case 'clear':
      return initialActiveRoomState;
  }
}

export function expectedRoomTime(state: RoomPlaybackState, now = Date.now()): number {
  const elapsed = state.playing ? Math.max(0, now - state.updatedAt) / 1000 : 0;
  return Math.max(0, state.currentTime + elapsed);
}

export function driftCorrection(
  localTime: number,
  remote: RoomPlaybackState,
  now = Date.now(),
  thresholdSeconds = 1.5,
): { seekTo: number | null; shouldPlay: boolean } {
  const expected = expectedRoomTime(remote, now);
  return {
    seekTo: Math.abs(localTime - expected) >= thresholdSeconds ? expected : null,
    shouldPlay: remote.playing,
  };
}

export function shouldRejoin(input: {
  connected: boolean;
  authenticated: boolean;
  roomId?: string | null;
  intentionallyLeft: boolean;
}): boolean {
  return Boolean(input.connected && input.authenticated && input.roomId && !input.intentionallyLeft);
}

export function isRoomPlaybackState(value: unknown): value is RoomPlaybackState {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<RoomPlaybackState>;
  return typeof item.playing === 'boolean'
    && Number.isFinite(item.currentTime)
    && Number.isFinite(item.updatedAt);
}

export function isPublicRoom(value: unknown): value is PublicRoom {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<PublicRoom>;
  return typeof item.id === 'string'
    && typeof item.slug === 'string'
    && Number.isFinite(item.episode)
    && typeof item.hostName === 'string'
    && Number.isFinite(item.viewerCount)
    && typeof item.playing === 'boolean'
    && typeof item.isPrivate === 'boolean'
    && Number.isFinite(item.createdAt);
}

export function isRoomUser(value: unknown): value is RoomUser {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<RoomUser>;
  return typeof item.id === 'string' && typeof item.name === 'string';
}

export function normalizeSocketError(value: unknown, fallback = 'Không thể kết nối phòng.'): Error {
  if (typeof value === 'string' && value.trim()) return new Error(value);
  if (value && typeof value === 'object') {
    const item = value as { error?: unknown; message?: unknown };
    const message = typeof item.error === 'string' ? item.error : item.message;
    if (typeof message === 'string' && message.trim()) return new Error(message);
  }
  return new Error(fallback);
}
