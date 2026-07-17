const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.PAYOS_CLIENT_ID = 'test-client';
process.env.PAYOS_API_KEY = 'test-api-key';
process.env.PAYOS_CHECKSUM_KEY = 'test-checksum-key';

const { isPayosConfigured, verifyPayosWebhook } = require('../dist/lib/payos');

function signatureFor(data) {
  const canonical = Object.keys(data)
    .sort()
    .map((key) => `${key}=${data[key] ?? ''}`)
    .join('&');
  return crypto.createHmac('sha256', process.env.PAYOS_CHECKSUM_KEY).update(canonical).digest('hex');
}

test('payOS is configured only when all credentials are available', () => {
  assert.equal(isPayosConfigured(), true);
});

test('payOS webhook verification accepts authentic data and rejects tampering', () => {
  const data = {
    orderCode: 1723456789012,
    amount: 99000,
    code: '00',
    description: 'VIP123',
    paymentLinkId: 'payment-link-id',
  };
  const payload = { code: '00', success: true, data, signature: signatureFor(data) };

  assert.equal(verifyPayosWebhook(payload), true);
  assert.equal(verifyPayosWebhook({ ...payload, data: { ...data, amount: 1000 } }), false);
  assert.equal(verifyPayosWebhook({ ...payload, signature: 'invalid' }), false);
});
