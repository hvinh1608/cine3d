const assert = require('node:assert/strict');
const test = require('node:test');
const bcrypt = require('bcrypt');
const {
  BCRYPT_MAX_PASSWORD_BYTES,
  PASSWORD_HASH_ROUNDS,
  hashPassword,
  passwordMatchesAny,
  passwordValidationError,
} = require('../dist/lib/password-security');

test('password hashes use the configured bcrypt work factor and a unique salt', async () => {
  const first = await hashPassword('Mat-khau-an-toan-123');
  const second = await hashPassword('Mat-khau-an-toan-123');

  assert.notEqual(first, second);
  assert.equal(await bcrypt.getRounds(first), PASSWORD_HASH_ROUNDS);
  assert.equal(await bcrypt.compare('Mat-khau-an-toan-123', first), true);
});

test('password history detects current and previous passwords', async () => {
  const hashes = await Promise.all([
    hashPassword('Mat-khau-hien-tai-123'),
    hashPassword('Mat-khau-truoc-do-456'),
  ]);

  assert.equal(await passwordMatchesAny('Mat-khau-hien-tai-123', hashes), true);
  assert.equal(await passwordMatchesAny('Mat-khau-truoc-do-456', hashes), true);
  assert.equal(await passwordMatchesAny('Mat-khau-hoan-toan-moi-789', hashes), false);
});

test('password validation protects bcrypt 72-byte input boundary', () => {
  assert.ok(passwordValidationError('short'));
  assert.equal(passwordValidationError('Mat-khau-hop-le-123'), null);
  assert.ok(passwordValidationError('a'.repeat(BCRYPT_MAX_PASSWORD_BYTES + 1)));
});
