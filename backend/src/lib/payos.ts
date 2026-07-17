import crypto from 'crypto';

const baseUrl = (process.env.PAYOS_API_URL || 'https://api-merchant.payos.vn').replace(/\/$/, '');
const clientId = () => process.env.PAYOS_CLIENT_ID?.trim() || '';
const apiKey = () => process.env.PAYOS_API_KEY?.trim() || '';
const checksumKey = () => process.env.PAYOS_CHECKSUM_KEY?.trim() || '';

export function isPayosConfigured() {
  return Boolean(clientId() && apiKey() && checksumKey());
}

function hmac(value: string) {
  return crypto.createHmac('sha256', checksumKey()).update(value).digest('hex');
}

function canonicalObject(data: Record<string, unknown>) {
  return Object.keys(data).sort().map((key) => {
    const value = data[key];
    const normalized = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    return `${key}=${normalized}`;
  }).join('&');
}

async function payosRequest(path: string, init: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'x-client-id': clientId(), 'x-api-key': apiKey(), ...init.headers },
  });
  const payload = await response.json() as any;
  if (!response.ok || payload?.code !== '00') throw new Error(payload?.desc || `payOS returned ${response.status}`);
  return payload.data;
}

export async function createPayosPayment(input: { orderCode: number; amount: number; description: string; returnUrl: string; cancelUrl: string; itemName: string; expiredAt: Date }) {
  const signatureData = {
    amount: input.amount, cancelUrl: input.cancelUrl, description: input.description,
    orderCode: input.orderCode, returnUrl: input.returnUrl,
  };
  return payosRequest('/v2/payment-requests', {
    method: 'POST',
    body: JSON.stringify({
      ...signatureData,
      items: [{ name: input.itemName, quantity: 1, price: input.amount }],
      expiredAt: Math.floor(input.expiredAt.getTime() / 1000),
      signature: hmac(canonicalObject(signatureData)),
    }),
  }) as Promise<{ paymentLinkId: string; checkoutUrl: string; qrCode: string }>;
}

export async function cancelPayosPayment(providerOrderCode: string) {
  return payosRequest(`/v2/payment-requests/${encodeURIComponent(providerOrderCode)}/cancel`, { method: 'POST', body: JSON.stringify({ cancellationReason: 'Người dùng hủy đơn' }) });
}

export function verifyPayosWebhook(payload: any) {
  if (!isPayosConfigured() || !payload?.data || typeof payload.signature !== 'string') return false;
  const expected = hmac(canonicalObject(payload.data));
  const actual = payload.signature.toLowerCase();
  return expected.length === actual.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}
