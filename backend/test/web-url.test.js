const assert = require('node:assert/strict');
const test = require('node:test');
const { canonicalWebUrl, passwordResetPageUrl } = require('../dist/lib/web-url');

test('production uses the CINE3D custom domain by default', () => {
  const env = { NODE_ENV: 'production' };
  assert.equal(canonicalWebUrl(env), 'https://cine3d.id.vn');
  assert.equal(passwordResetPageUrl(env), 'https://cine3d.id.vn/account');
});

test('legacy Vercel password reset links are canonicalized in production', () => {
  const env = {
    NODE_ENV: 'production',
    PASSWORD_RESET_URL: 'https://cine3d.vercel.app/account/',
  };
  assert.equal(passwordResetPageUrl(env), 'https://cine3d.id.vn/account');
});

test('an explicit custom canonical domain controls the production reset link', () => {
  const env = {
    NODE_ENV: 'production',
    CANONICAL_WEB_URL: 'https://www.cine3d.id.vn/',
    PASSWORD_RESET_URL: 'https://cine3d.vercel.app/account',
  };
  assert.equal(passwordResetPageUrl(env), 'https://www.cine3d.id.vn/account');
});

test('development keeps an explicitly configured local or deep-link reset URL', () => {
  assert.equal(passwordResetPageUrl({
    NODE_ENV: 'development',
    PASSWORD_RESET_URL: 'http://localhost:3000/account',
  }), 'http://localhost:3000/account');
  assert.equal(passwordResetPageUrl({
    NODE_ENV: 'development',
    PASSWORD_RESET_URL: 'cine3d://account/auth',
  }), 'cine3d://account/auth');
});
