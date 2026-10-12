import crypto from 'crypto';

type RoomAccessPayload = { roomId: string; userId: string; accessKey: string; expiresAt: number };

function signingKey() {
  const configured = process.env.WATCH_ROOM_TOKEN_SECRET?.trim() || process.env.JWT_ACCESS_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('WATCH_ROOM_TOKEN_SECRET or JWT_ACCESS_SECRET must be set in production.');
  }
  return 'development-watch-room-secret-change-me';
}

function signature(encodedPayload: string) {
  return crypto.createHmac('sha256', signingKey()).update(encodedPayload).digest('base64url');
}

export function issueRoomAccessToken(payload: RoomAccessPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${signature(encoded)}`;
}

export function verifyRoomAccessToken(token: unknown, expected: Omit<RoomAccessPayload, 'expiresAt'>, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 2_000) return false;
  const [encoded, providedSignature, extra] = token.split('.');
  if (!encoded || !providedSignature || extra) return false;
  const expectedSignature = signature(encoded);
  if (providedSignature.length !== expectedSignature.length || !crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature))) return false;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as RoomAccessPayload;
    return payload.roomId === expected.roomId && payload.userId === expected.userId
      && payload.accessKey === expected.accessKey && Number.isFinite(payload.expiresAt) && payload.expiresAt > now;
  } catch { return false; }
}
