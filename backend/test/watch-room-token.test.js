const test = require('node:test');
const assert = require('node:assert/strict');

process.env.WATCH_ROOM_TOKEN_SECRET = 'test-secret-with-sufficient-entropy';
const { issueRoomAccessToken, verifyRoomAccessToken } = require('../dist/lib/watch-room-token');

test('room access tokens are bound to room, user, secret and expiry', () => {
  const payload = { roomId: 'room-1', userId: 'user-1', accessKey: 'room-secret', expiresAt: 2_000 };
  const token = issueRoomAccessToken(payload);
  assert.equal(verifyRoomAccessToken(token, { roomId: 'room-1', userId: 'user-1', accessKey: 'room-secret' }, 1_000), true);
  assert.equal(verifyRoomAccessToken(token, { roomId: 'room-2', userId: 'user-1', accessKey: 'room-secret' }, 1_000), false);
  assert.equal(verifyRoomAccessToken(token, { roomId: 'room-1', userId: 'user-2', accessKey: 'room-secret' }, 1_000), false);
  assert.equal(verifyRoomAccessToken(token, { roomId: 'room-1', userId: 'user-1', accessKey: 'room-secret' }, 2_001), false);
  assert.equal(verifyRoomAccessToken(`${token}tampered`, { roomId: 'room-1', userId: 'user-1', accessKey: 'room-secret' }, 1_000), false);
});
