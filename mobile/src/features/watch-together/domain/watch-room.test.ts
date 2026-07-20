import {
  driftCorrection,
  initialActiveRoomState,
  isPublicRoom,
  isRoomPlaybackState,
  roomReducer,
  shouldRejoin,
  type JoinedRoom,
} from './watch-room';

const room: JoinedRoom = {
  roomId: 'abc',
  slug: 'movie',
  episode: 1,
  hostId: 'host',
  users: [{ id: 'host', name: 'Host' }],
  isPrivate: false,
  state: { playing: false, currentTime: 10, updatedAt: 1_000 },
};

describe('watch room reducer', () => {
  it('applies room snapshots and bounds chat history', () => {
    let state = roomReducer(initialActiveRoomState, { type: 'joined', room });
    state = roomReducer(state, {
      type: 'users',
      users: [...room.users, { id: 'guest', name: 'Guest' }],
      hostId: 'guest',
      episode: 2,
      isPrivate: true,
    });
    for (let index = 0; index < 305; index += 1) {
      state = roomReducer(state, {
        type: 'message',
        message: { id: String(index), name: 'Guest', message: String(index), createdAt: index },
      });
    }
    expect(state.room).toMatchObject({ hostId: 'guest', episode: 2, isPrivate: true });
    expect(state.messages).toHaveLength(300);
    expect(state.messages[0]?.id).toBe('5');
  });

  it('clears stale room state when the room ends', () => {
    const joined = roomReducer(initialActiveRoomState, { type: 'joined', room });
    const ended = roomReducer(joined, { type: 'ended', reason: 'Đã đóng' });
    expect(ended.room).toBeNull();
    expect(ended.endedReason).toBe('Đã đóng');
  });
});

describe('drift correction', () => {
  it('projects playing state using server timestamp', () => {
    const correction = driftCorrection(10, { playing: true, currentTime: 10, updatedAt: 1_000 }, 4_000);
    expect(correction.seekTo).toBe(13);
    expect(correction.shouldPlay).toBe(true);
  });

  it('does not seek inside the correction threshold', () => {
    const correction = driftCorrection(12.2, { playing: true, currentTime: 10, updatedAt: 1_000 }, 3_000);
    expect(correction.seekTo).toBeNull();
  });
});

describe('reconnect decisions', () => {
  it('only rejoins authenticated active sessions', () => {
    expect(shouldRejoin({ connected: true, authenticated: true, roomId: 'abc', intentionallyLeft: false })).toBe(true);
    expect(shouldRejoin({ connected: true, authenticated: true, roomId: 'abc', intentionallyLeft: true })).toBe(false);
    expect(shouldRejoin({ connected: false, authenticated: true, roomId: 'abc', intentionallyLeft: false })).toBe(false);
    expect(shouldRejoin({ connected: true, authenticated: false, roomId: 'abc', intentionallyLeft: false })).toBe(false);
  });
});

describe('event validation', () => {
  it('accepts valid room events and rejects malformed payloads', () => {
    expect(isRoomPlaybackState({ playing: true, currentTime: 1, updatedAt: 2 })).toBe(true);
    expect(isRoomPlaybackState({ playing: 'yes', currentTime: 1, updatedAt: 2 })).toBe(false);
    expect(isPublicRoom({
      id: 'abc',
      slug: 'movie',
      episode: 1,
      hostName: 'Host',
      viewerCount: 2,
      playing: false,
      isPrivate: false,
      createdAt: 10,
    })).toBe(true);
    expect(isPublicRoom({ id: 'abc', slug: 'movie' })).toBe(false);
  });
});
