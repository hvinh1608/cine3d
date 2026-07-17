const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getRefreshCookieClearOptions,
  getRefreshCookieOptions,
  REFRESH_COOKIE_MAX_AGE_MS,
  REFRESH_COOKIE_NAME,
} = require('../dist/lib/auth-cookie');

test('refresh cookie is HttpOnly, host-only and auth-path scoped in development', () => {
  const options = getRefreshCookieOptions({ NODE_ENV: 'development', COOKIE_SECURE: 'false' });

  assert.equal(REFRESH_COOKIE_NAME, 'cine3d_refresh');
  assert.deepEqual(options, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: '/api/auth',
    priority: 'high',
  });
  assert.equal(options.domain, undefined);
});

test('production refresh cookie remains cross-site compatible even if COOKIE_SECURE is false', () => {
  const options = getRefreshCookieOptions({ NODE_ENV: 'production', COOKIE_SECURE: 'false' });

  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, 'none');
  assert.equal(options.priority, 'high');
});

test('refresh cookie clearing uses the same scope without extending its lifetime', () => {
  const options = getRefreshCookieClearOptions({ NODE_ENV: 'production' });

  assert.equal(options.secure, true);
  assert.equal(options.sameSite, 'none');
  assert.equal(options.path, '/api/auth');
  assert.equal(options.maxAge, undefined);
});
