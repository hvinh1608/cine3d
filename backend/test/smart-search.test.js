const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSearchText, smartSearchScore } = require('../dist/lib/smart-search');

test('smart search ignores Vietnamese accents', () => {
  assert.equal(normalizeSearchText('Trò Chơi Vương Quyền'), 'tro choi vuong quyen');
  assert.ok(smartSearchScore('tro choi vuong quyen', ['Trò Chơi Vương Quyền']) >= 70);
});

test('smart search tolerates a small typo and searches people names', () => {
  assert.ok(smartSearchScore('luu diec phi', ['Lưu Diệc Phi']) >= 70);
  assert.ok(smartSearchScore('vuong quyen', ['Trò Chơi Vương Quền']) > 0);
});
