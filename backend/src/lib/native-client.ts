import crypto from 'crypto';
import type { Request } from 'express';

export function isNativeClient(req: Pick<Request, 'get'>): boolean {
  return req.get('x-client-type')?.trim().toLowerCase() === 'mobile';
}

export function sessionResponse<T extends Record<string, unknown>>(
  req: Pick<Request, 'get'>,
  body: T,
  refreshToken: string
): T & { refreshToken?: string } {
  return isNativeClient(req) ? { ...body, refreshToken } : body;
}

export function configuredGoogleAudiences(env: NodeJS.ProcessEnv = process.env): string[] {
  return [...new Set([
    ...(env.GOOGLE_CLIENT_IDS || '').split(','),
    env.GOOGLE_CLIENT_ID || '',
    env.GOOGLE_ANDROID_CLIENT_ID || '',
  ].map((value) => value.trim()).filter(Boolean))];
}

export function validAppAttestation(value: unknown, configuredSecret = process.env.MOBILE_APP_ATTESTATION_TOKEN): boolean {
  if (typeof value !== 'string' || !configuredSecret) return false;
  const received = Buffer.from(value);
  const expected = Buffer.from(configuredSecret);
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

/**
 * Native apps cannot complete Cloudflare Turnstile widgets.
 * Prefer a shared attestation secret; if the secret is not configured yet,
 * allow native clients so login/register are not permanently blocked.
 */
export function evaluateNativeAuthGate(
  attestationHeader: unknown,
  configuredSecret = process.env.MOBILE_APP_ATTESTATION_TOKEN,
): { ok: true; mode: 'attestation' | 'open' } | { ok: false; code: 'NATIVE_ATTESTATION_REQUIRED' | 'NATIVE_ATTESTATION_MISMATCH' } {
  const configured = typeof configuredSecret === 'string' ? configuredSecret.trim() : '';
  if (!configured) {
    return { ok: true, mode: 'open' };
  }
  if (validAppAttestation(attestationHeader, configured)) {
    return { ok: true, mode: 'attestation' };
  }
  const provided = typeof attestationHeader === 'string' && attestationHeader.trim().length > 0;
  return {
    ok: false,
    code: provided ? 'NATIVE_ATTESTATION_MISMATCH' : 'NATIVE_ATTESTATION_REQUIRED',
  };
}

export function hashOpaqueToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function isEligibleDownloadSource(source: {
  url: string;
  type: string;
  healthStatus: string;
}): boolean {
  let parsed: URL;
  try {
    parsed = new URL(source.url);
  } catch {
    return false;
  }
  return parsed.protocol === 'https:'
    && ['hls', 'mp4'].includes(source.type.toLowerCase())
    && source.healthStatus.toLowerCase() !== 'down';
}

export function parseProductPlanMap(raw = process.env.PLAY_PRODUCT_PLAN_MAP): Record<string, string> {
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('PLAY_PRODUCT_PLAN_MAP must be a JSON object.');
  }
  const result: Record<string, string> = {};
  for (const [productId, planRef] of Object.entries(parsed)) {
    if (productId.trim() && typeof planRef === 'string' && planRef.trim()) {
      result[productId.trim()] = planRef.trim();
    }
  }
  return result;
}
