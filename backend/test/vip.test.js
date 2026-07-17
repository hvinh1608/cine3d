const test = require('node:test');
const assert = require('node:assert/strict');
const { hasVipAccess, extendVipExpiry } = require('../dist/lib/vip');
const { shapeMovieForViewer } = require('../dist/lib/vip-content');

test('hasVipAccess supports permanent and time-limited VIP while denying locked users', () => {
  const now = new Date('2026-07-14T00:00:00.000Z');
  assert.equal(hasVipAccess({ isVip: true, vipExpiresAt: null }, now), true);
  assert.equal(hasVipAccess({ isVip: false, vipExpiresAt: new Date('2026-07-15T00:00:00.000Z') }, now), true);
  assert.equal(hasVipAccess({ isVip: false, vipExpiresAt: new Date('2026-07-13T00:00:00.000Z') }, now), false);
  assert.equal(hasVipAccess({ isVip: true, vipExpiresAt: null, isLocked: true }, now), false);
});

test('extendVipExpiry stacks new time on an active subscription', () => {
  const now = new Date('2026-07-14T00:00:00.000Z');
  const current = new Date('2026-08-13T00:00:00.000Z');
  assert.equal(extendVipExpiry(current, 30, now).toISOString(), '2026-09-12T00:00:00.000Z');
  assert.equal(extendVipExpiry(null, 30, now).toISOString(), '2026-08-13T00:00:00.000Z');
});

test('free viewers only receive free sources while VIP viewers receive Premium, 2K and 4K first', () => {
  const movie = {
    isVip: false,
    episodes: [{
      id: 'episode-1',
      videoSources: [
        { id: 'free', quality: '1080p', isPremium: false },
        { id: 'premium', quality: '1080p', isPremium: true },
        { id: '2k', quality: '1440p', isPremium: false },
        { id: '4k', quality: '2160p', isPremium: false },
      ],
    }],
  };

  const freeResult = shapeMovieForViewer(movie, false);
  assert.deepEqual(freeResult.episodes[0].videoSources.map((source) => source.id), ['free']);
  assert.equal(freeResult.episodes[0].premiumSourcesLocked, 3);

  const vipResult = shapeMovieForViewer(movie, true);
  assert.deepEqual(vipResult.episodes[0].videoSources.map((source) => source.id), ['premium', '2k', '4k', 'free']);
  assert.equal(vipResult.episodes[0].videoSources[1].isPremium, true);
  assert.equal(vipResult.episodes[0].premiumSourcesLocked, 0);
});

test('early-access movies hide every source from free viewers until the deadline', () => {
  const now = new Date('2026-07-14T00:00:00.000Z');
  const movie = {
    isVip: false,
    vipEarlyAccessUntil: '2026-07-15T00:00:00.000Z',
    episodes: [{ videoSources: [{ id: 'free', quality: '1080p' }] }],
  };

  const duringEarlyAccess = shapeMovieForViewer(movie, false, now);
  assert.equal(duringEarlyAccess.isEarlyAccess, true);
  assert.equal(duringEarlyAccess.requiresVip, true);
  assert.equal(duringEarlyAccess.episodes[0].videoSources.length, 0);

  const afterEarlyAccess = shapeMovieForViewer(movie, false, new Date('2026-07-16T00:00:00.000Z'));
  assert.equal(afterEarlyAccess.isEarlyAccess, false);
  assert.equal(afterEarlyAccess.requiresVip, false);
  assert.equal(afterEarlyAccess.episodes[0].videoSources.length, 1);
});

test('repeatedly failed sources are hidden while retaining a last-resort source', () => {
  const movie = { isVip: false, episodes: [{ videoSources: [
    { id: 'dead', quality: '1080p', healthStatus: 'failed', consecutiveFailures: 3 },
    { id: 'good', quality: '1080p', healthStatus: 'healthy', consecutiveFailures: 0 },
  ] }] };
  assert.deepEqual(shapeMovieForViewer(movie, false).episodes[0].videoSources.map((source) => source.id), ['good']);

  const allFailed = { isVip: false, episodes: [{ videoSources: [
    { id: 'last-resort', quality: '1080p', healthStatus: 'failed', consecutiveFailures: 5 },
  ] }] };
  assert.deepEqual(shapeMovieForViewer(allFailed, false).episodes[0].videoSources.map((source) => source.id), ['last-resort']);
});
