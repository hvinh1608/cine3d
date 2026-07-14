const test = require('node:test');
const assert = require('node:assert/strict');
const { hasVipAccess, extendVipExpiry } = require('../dist/lib/vip');

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
