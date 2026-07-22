const test = require('node:test');
const assert = require('node:assert/strict');

const {
  configuredGoogleAudiences,
  evaluateNativeAuthGate,
  hashOpaqueToken,
  isEligibleDownloadSource,
  isNativeClient,
  parseProductPlanMap,
  sessionResponse,
  validAppAttestation,
} = require('../dist/lib/native-client');

function request(headers = {}) {
  return { get: (name) => headers[name.toLowerCase()] };
}

test('web sessions remain backward compatible without refreshToken JSON', () => {
  const req = request({});
  assert.equal(isNativeClient(req), false);
  assert.deepEqual(sessionResponse(req, { accessToken: 'access' }, 'refresh'), { accessToken: 'access' });
});

test('only explicitly marked mobile sessions receive refreshToken JSON', () => {
  const req = request({ 'x-client-type': ' Mobile ' });
  assert.equal(isNativeClient(req), true);
  assert.deepEqual(sessionResponse(req, { accessToken: 'access' }, 'refresh'), {
    accessToken: 'access',
    refreshToken: 'refresh',
  });
});

test('Google audiences combine configured IDs with the production web audience', () => {
  assert.deepEqual(configuredGoogleAudiences({
    GOOGLE_CLIENT_IDS: 'web-one, web-two,web-one',
    GOOGLE_CLIENT_ID: 'legacy',
    GOOGLE_ANDROID_CLIENT_ID: 'android',
  }), [
    'web-one',
    'web-two',
    'legacy',
    'android',
    '351178371430-1bum195duljbh950btqqvk8c2tamjcb6.apps.googleusercontent.com',
  ]);
});

test('app attestation requires an exact configured server secret', () => {
  assert.equal(validAppAttestation('secret', 'secret'), true);
  assert.equal(validAppAttestation('wrong', 'secret'), false);
  assert.equal(validAppAttestation('secret', undefined), false);
});

test('native auth gate allows open mode when secret is unset', () => {
  assert.deepEqual(evaluateNativeAuthGate('anything', undefined), { ok: true, mode: 'open' });
  assert.deepEqual(evaluateNativeAuthGate('secret', 'secret'), { ok: true, mode: 'attestation' });
  assert.deepEqual(evaluateNativeAuthGate('wrong', 'secret'), { ok: false, code: 'NATIVE_ATTESTATION_MISMATCH' });
  assert.deepEqual(evaluateNativeAuthGate('', 'secret'), { ok: false, code: 'NATIVE_ATTESTATION_REQUIRED' });
});

test('download source eligibility rejects insecure, malformed, and down sources', () => {
  assert.equal(isEligibleDownloadSource({ url: 'https://cdn.test/video.m3u8', type: 'hls', healthStatus: 'healthy' }), true);
  assert.equal(isEligibleDownloadSource({ url: 'http://cdn.test/video.mp4', type: 'mp4', healthStatus: 'healthy' }), false);
  assert.equal(isEligibleDownloadSource({ url: 'https://cdn.test/video.mp4', type: 'mp4', healthStatus: 'down' }), false);
  assert.equal(isEligibleDownloadSource({ url: 'not-a-url', type: 'mp4', healthStatus: 'healthy' }), false);
});

test('product mapping only accepts a JSON object of string references', () => {
  assert.deepEqual(parseProductPlanMap('{"monthly":"VIP_MONTHLY","ignored":3}'), { monthly: 'VIP_MONTHLY' });
  assert.throws(() => parseProductPlanMap('[]'), /JSON object/);
});

test('opaque entitlement tokens are only represented by deterministic hashes', () => {
  const hash = hashOpaqueToken('raw-token');
  assert.equal(hash.length, 64);
  assert.notEqual(hash, 'raw-token');
  assert.equal(hash, hashOpaqueToken('raw-token'));
});
