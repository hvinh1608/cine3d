import { Response } from 'express';
import { prisma } from '../lib/prisma';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { AuthenticatedRequest } from '../middleware/auth';
import { internalError } from '../lib/http-error';
import { hasVipAccess } from '../lib/vip';
import { emailDeliveryConfigured, sendActionEmail } from '../services/email.service';
import {
  getRefreshCookieClearOptions,
  getRefreshCookieOptions,
  REFRESH_COOKIE_NAME,
} from '../lib/auth-cookie';
import {
  configuredGoogleAudiences,
  evaluateNativeAuthGate,
  isNativeClient,
  sessionResponse,
} from '../lib/native-client';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const REFRESH_COOKIE = REFRESH_COOKIE_NAME;
const requireEmailVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
const googleAudiences = configuredGoogleAudiences();
const googleClient = googleAudiences.length ? new OAuth2Client() : null;
const facebookAppId = process.env.FACEBOOK_APP_ID?.trim();
const facebookAppSecret = process.env.FACEBOOK_APP_SECRET?.trim();
const facebookGraphVersion = process.env.FACEBOOK_GRAPH_VERSION?.trim() || 'v24.0';
const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY?.trim();
const clientUrl = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')[0]
  .trim()
  .replace(/\/$/, '');
const cookieOptions = getRefreshCookieOptions();
const cookieClearOptions = getRefreshCookieClearOptions();

type BotGateFailure = {
  ok: false;
  status: 400;
  code: 'NATIVE_ATTESTATION_REQUIRED' | 'NATIVE_ATTESTATION_MISMATCH' | 'TURNSTILE_REQUIRED';
  message: string;
};

type BotGateResult = { ok: true } | BotGateFailure;

async function verifyBotGate(token: unknown, req: AuthenticatedRequest): Promise<BotGateResult> {
  if (isNativeClient(req)) {
    const gate = evaluateNativeAuthGate(req.get('x-app-attestation'));
    if (gate.ok) {
      if (gate.mode === 'open') {
        console.warn('[auth] MOBILE_APP_ATTESTATION_TOKEN is unset; allowing native client without Turnstile.');
      }
      return { ok: true };
    }
    return {
      ok: false,
      status: 400,
      code: gate.code,
      message: gate.code === 'NATIVE_ATTESTATION_MISMATCH'
        ? 'App attestation không khớp máy chủ. Kiểm tra EXPO_PUBLIC_APP_ATTESTATION_TOKEN và MOBILE_APP_ATTESTATION_TOKEN.'
        : 'Ứng dụng native cần header X-App-Attestation hợp lệ.',
    };
  }

  if (!turnstileSecretKey) {
    // Web auth without Turnstile configured (local/dev).
    return { ok: true };
  }
  if (typeof token !== 'string' || !token.trim()) {
    return {
      ok: false,
      status: 400,
      code: 'TURNSTILE_REQUIRED',
      message: 'Vui lòng hoàn tất xác minh Cloudflare rồi thử lại.',
    };
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: turnstileSecretKey,
        response: token,
        remoteip: req.ip,
      }),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: 400,
        code: 'TURNSTILE_REQUIRED',
        message: 'Vui lòng hoàn tất xác minh Cloudflare rồi thử lại.',
      };
    }
    const result = await response.json() as { success?: boolean };
    if (result.success === true) return { ok: true };
    return {
      ok: false,
      status: 400,
      code: 'TURNSTILE_REQUIRED',
      message: 'Vui lòng hoàn tất xác minh Cloudflare rồi thử lại.',
    };
  } catch (error) {
    console.warn('Turnstile verification failed.', error);
    return {
      ok: false,
      status: 400,
      code: 'TURNSTILE_REQUIRED',
      message: 'Vui lòng hoàn tất xác minh Cloudflare rồi thử lại.',
    };
  }
}

function rejectBotGate(res: Response, gate: BotGateFailure) {
  return res.status(gate.status).json({ message: gate.message, code: gate.code });
}

type SessionUser = {
  id: string;
  email: string;
  username: string;
  avatar: string | null;
  isVip: boolean;
  vipExpiresAt: Date | null;
  role: { name: string };
};

function getSessionMetadata(req: AuthenticatedRequest) {
  const userAgent = req.get('user-agent')?.slice(0, 500) || null;
  const browser = userAgent?.match(/(Edg|Chrome|Firefox|Safari|OPR)\/[\d.]+/)?.[1] || 'Trình duyệt';
  const os = userAgent?.match(/Windows NT|Android|iPhone|iPad|Mac OS X|Linux/)?.[0]?.replace('Windows NT', 'Windows') || 'Thiết bị';
  const forwarded = req.get('x-forwarded-for')?.split(',')[0]?.trim();
  return {
    deviceName: `${browser} · ${os}`.slice(0, 100),
    userAgent,
    ipAddress: (forwarded || req.ip || '').slice(0, 100) || null,
    lastUsedAt: new Date(),
  };
}

function getRefreshTokenDuration(req: AuthenticatedRequest): { jwt: jwt.SignOptions['expiresIn']; ms: number } {
  const days = isNativeClient(req)
    ? Number(process.env.NATIVE_REFRESH_TTL_DAYS || 30)
    : 7;
  return {
    jwt: `${days}d` as jwt.SignOptions['expiresIn'],
    ms: days * 24 * 60 * 60 * 1000,
  };
}

async function createSession(user: SessionUser, req: AuthenticatedRequest) {
  const payload = {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role.name,
  };

  const refreshDuration = getRefreshTokenDuration(req);
  const accessToken = jwt.sign(payload, JWT_ACCESS_SECRET!, { expiresIn: '15m' });
  const refreshToken = jwt.sign(
    { ...payload, jti: crypto.randomUUID() },
    JWT_REFRESH_SECRET!,
    { expiresIn: refreshDuration.jwt }
  );

  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    prisma.refreshToken.create({
      data: {
        token: hashToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + refreshDuration.ms),
        ...getSessionMetadata(req),
      },
    }),
  ]);

  return {
    accessToken,
    refreshToken,
    user: {
      ...payload,
      avatar: user.avatar,
      isVip: hasVipAccess(user),
      vipExpiresAt: user.vipExpiresAt,
    },
  };
}

function getCookie(req: AuthenticatedRequest, name: string): string | undefined {
  const cookies = req.headers.cookie?.split(';') || [];
  const entry = cookies.find((cookie) => cookie.trim().startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.trim().slice(name.length + 1)) : undefined;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createActionToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  };
}

async function createAvailableUsername(name: string, email: string) {
  const rawBase = name || email.split('@')[0] || 'cine3d-user';
  const base = rawBase
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'cine3d-user';

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
    const candidate = `${base.slice(0, 40 - suffix.length)}${suffix}`;
    const existing = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }

  return `cine3d-${crypto.randomUUID().slice(0, 8)}`;
}

async function sendVerificationEmail(
  req: AuthenticatedRequest,
  user: { email: string; username: string },
  token: string
) {
  const publicApiUrl = (process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}/api`).replace(/\/$/, '');
  await sendActionEmail({
    to: user.email,
    username: user.username,
    subject: 'Xác nhận tài khoản CINE3D',
    heading: 'Xác nhận địa chỉ email',
    message: 'Nhấn nút bên dưới để kích hoạt tài khoản CINE3D của bạn.',
    actionLabel: 'Xác nhận tài khoản',
    actionUrl: `${publicApiUrl}/auth/verify-email?token=${encodeURIComponent(token)}`,
  });
}

if (!JWT_ACCESS_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in environment variables.');
}
if (
  process.env.NODE_ENV === 'production' &&
  (JWT_ACCESS_SECRET.length < 32 || JWT_REFRESH_SECRET.length < 32 ||
    JWT_ACCESS_SECRET.includes('change_me') || JWT_REFRESH_SECRET.includes('change_me'))
) {
  throw new Error('Production JWT secrets must be unique and contain at least 32 characters.');
}
export const register = async (req: AuthenticatedRequest, res: Response) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const { password } = req.body;

  if (!email || !username || !password) {
    return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin.' });
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ message: 'Email không hợp lệ.' });
  }

  if (username.length < 3 || username.length > 40) {
    return res.status(400).json({ message: 'Tên tài khoản phải từ 3 đến 40 ký tự.' });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 8 ký tự.' });
  }
  const botGate = await verifyBotGate(req.body.turnstileToken, req);
  if (!botGate.ok) return rejectBotGate(res, botGate);
  if (requireEmailVerification && !emailDeliveryConfigured) {
    return res.status(503).json({ message: 'Gửi email xác nhận chưa được cấu hình.' });
  }

  try {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      if (requireEmailVerification && existingUser.email === email && !existingUser.isVerified) {
        const verification = createActionToken();
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            emailVerificationToken: verification.tokenHash,
            emailVerificationExpires: verification.expiresAt,
          },
        });

        try {
          await sendVerificationEmail(req, existingUser, verification.token);
        } catch (emailError) {
          console.error('Verification email resend failed.', emailError);
          return res.status(503).json({ message: 'Không thể gửi lại email xác nhận. Vui lòng thử sau.' });
        }

        return res.json({
          message: 'Tài khoản đang chờ xác nhận. Email xác nhận mới đã được gửi lại.',
          requiresVerification: true,
        });
      }

      return res.status(400).json({
        message: 'Email hoặc tên tài khoản đã được sử dụng. Hãy chuyển sang đăng nhập.',
        code: 'ACCOUNT_EXISTS',
      });
    }

    // Retrieve default 'USER' role
    let userRole = await prisma.role.findFirst({ where: { name: 'USER' } });
    if (!userRole) {
      userRole = await prisma.role.create({ data: { name: 'USER' } });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verification = requireEmailVerification ? createActionToken() : null;

    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        roleId: userRole.id,
        isVerified: !requireEmailVerification,
        emailVerificationToken: verification?.tokenHash,
        emailVerificationExpires: verification?.expiresAt,
      },
      include: { role: true },
    });

    if (verification) {
      try {
        await sendVerificationEmail(req, user, verification.token);
      } catch (emailError) {
        console.error('Verification email delivery failed.', emailError);
        await prisma.user.delete({ where: { id: user.id } });
        return res.status(503).json({ message: 'Không thể gửi email xác nhận. Vui lòng thử lại sau.' });
      }

      return res.status(201).json({
        message: 'Đăng ký thành công. Hãy kiểm tra email để xác nhận tài khoản.',
        requiresVerification: true,
      });
    }

    const session = await createSession(user, req);
    if (!isNativeClient(req)) res.cookie(REFRESH_COOKIE, session.refreshToken, cookieOptions);

    return res.status(201).json(sessionResponse(req, {
      message: 'Đăng ký thành công.',
      accessToken: session.accessToken,
      user: session.user,
    }, session.refreshToken));
  } catch (error: any) {
    return internalError(res, 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.', error);
  }
};

export const login = async (req: AuthenticatedRequest, res: Response) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const { password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu.' });
  }

  const botGate = await verifyBotGate(req.body.turnstileToken, req);
  if (!botGate.ok) return rejectBotGate(res, botGate);

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' });
    }

    if (user.isLocked) {
      return res.status(403).json({ message: 'Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ.' });
    }

    if (requireEmailVerification && !user.isVerified) {
      return res.status(403).json({
        message: 'Tài khoản chưa được xác nhận. Hãy kiểm tra email đăng ký.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' });
    }

    const session = await createSession(user, req);
    if (!isNativeClient(req)) res.cookie(REFRESH_COOKIE, session.refreshToken, cookieOptions);
    return res.json(sessionResponse(req, {
      accessToken: session.accessToken,
      user: session.user,
    }, session.refreshToken));
  } catch (error: any) {
    return internalError(res, 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.', error);
  }
};

function sanitizeGoogleAvatar(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return null;
    if (!parsed.hostname.endsWith('googleusercontent.com')) return null;
    return trimmed;
  } catch {
    return null;
  }
}

export const googleLogin = async (req: AuthenticatedRequest, res: Response) => {
  const credential = typeof req.body.credential === 'string' ? req.body.credential.trim() : '';
  if (!credential) {
    return res.status(400).json({ message: 'Thiếu thông tin đăng nhập Google.' });
  }
  const clientAvatar = sanitizeGoogleAvatar(req.body.avatar);
  const botGate = await verifyBotGate(req.body.turnstileToken, req);
  if (!botGate.ok) return rejectBotGate(res, botGate);
  if (!googleClient || !googleAudiences.length) {
    return res.status(503).json({ message: 'Đăng nhập Google chưa được cấu hình.' });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: googleAudiences,
    });
    payload = ticket.getPayload();
  } catch (error: unknown) {
    console.warn('Google credential verification failed.', error);
    return res.status(401).json({ message: 'Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn.' });
  }

  try {
    const googleId = payload?.sub;
    const email = payload?.email?.trim().toLowerCase();

    if (!googleId || !email || payload?.email_verified !== true) {
      return res.status(401).json({ message: 'Tài khoản Google không hợp lệ hoặc email chưa được xác minh.' });
    }

    let user = await prisma.user.findUnique({
      where: { googleId },
      include: { role: true },
    });

    if (!user) {
      const emailAccount = await prisma.user.findUnique({
        where: { email },
        select: { id: true, isLocked: true },
      });
      if (emailAccount?.isLocked) {
        return res.status(403).json({ message: 'Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ.' });
      }
      if (emailAccount) {
        return res.status(409).json({
          message: 'Email này đã được đăng ký bằng mật khẩu. Hãy đăng nhập bằng email và mật khẩu.',
          code: 'EMAIL_PASSWORD_ACCOUNT_EXISTS',
        });
      }
    }

    if (user?.isLocked) {
      return res.status(403).json({ message: 'Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ.' });
    }

    const googleAvatar = sanitizeGoogleAvatar(payload?.picture) || clientAvatar;

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId,
          isVerified: true,
          avatar: user.avatar || googleAvatar || null,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        },
        include: { role: true },
      });
    } else {
      const role = await prisma.role.upsert({
        where: { name: 'USER' },
        update: {},
        create: { name: 'USER' },
      });
      const username = await createAvailableUsername(payload.name || '', email);
      const password = await bcrypt.hash(crypto.randomBytes(48).toString('hex'), 10);

      user = await prisma.user.create({
        data: {
          googleId,
          email,
          username,
          password,
          avatar: googleAvatar,
          isVerified: true,
          roleId: role.id,
        },
        include: { role: true },
      });
    }

    const session = await createSession(user, req);
    if (!isNativeClient(req)) res.cookie(REFRESH_COOKIE, session.refreshToken, cookieOptions);
    return res.json(sessionResponse(req, {
      message: 'Đăng nhập Google thành công.',
      accessToken: session.accessToken,
      user: session.user,
    }, session.refreshToken));
  } catch (error: unknown) {
    return internalError(res, 'Không thể hoàn tất đăng nhập Google.', error);
  }
};

export const facebookLogin = async (req: AuthenticatedRequest, res: Response) => {
  const accessToken = typeof req.body.accessToken === 'string' ? req.body.accessToken.trim() : '';
  if (!accessToken) return res.status(400).json({ message: 'Thiếu thông tin đăng nhập Facebook.' });
  const botGate = await verifyBotGate(req.body.turnstileToken, req);
  if (!botGate.ok) return rejectBotGate(res, botGate);
  if (!facebookAppId || !facebookAppSecret) {
    return res.status(503).json({ message: 'Đăng nhập Facebook chưa được cấu hình.' });
  }

  try {
    const appAccessToken = `${facebookAppId}|${facebookAppSecret}`;
    const debugUrl = new URL(`https://graph.facebook.com/${facebookGraphVersion}/debug_token`);
    debugUrl.searchParams.set('input_token', accessToken);
    debugUrl.searchParams.set('access_token', appAccessToken);
    const debugResponse = await fetch(debugUrl);
    const debugResult = await debugResponse.json() as { data?: { app_id?: string; is_valid?: boolean; user_id?: string } };
    const tokenData = debugResult.data;
    if (!debugResponse.ok || !tokenData?.is_valid || tokenData.app_id !== facebookAppId || !tokenData.user_id) {
      return res.status(401).json({ message: 'Phiên đăng nhập Facebook không hợp lệ hoặc đã hết hạn.' });
    }

    const proof = crypto.createHmac('sha256', facebookAppSecret).update(accessToken).digest('hex');
    const profileUrl = new URL(`https://graph.facebook.com/${facebookGraphVersion}/me`);
    profileUrl.searchParams.set('fields', 'id,name,email,picture.type(large)');
    profileUrl.searchParams.set('access_token', accessToken);
    profileUrl.searchParams.set('appsecret_proof', proof);
    const profileResponse = await fetch(profileUrl);
    const profile = await profileResponse.json() as {
      id?: string;
      name?: string;
      email?: string;
      picture?: { data?: { url?: string } };
    };
    const facebookId = profile.id;
    const email = profile.email?.trim().toLowerCase();
    if (!profileResponse.ok || !facebookId || facebookId !== tokenData.user_id) {
      return res.status(401).json({ message: 'Không thể xác minh tài khoản Facebook.' });
    }
    if (!email) {
      return res.status(400).json({ message: 'Facebook chưa chia sẻ email. Hãy cấp quyền email hoặc đăng nhập bằng phương thức khác.' });
    }

    let user = await prisma.user.findUnique({ where: { facebookId }, include: { role: true } });
    if (!user) {
      const emailAccount = await prisma.user.findUnique({ where: { email }, select: { id: true, isLocked: true } });
      if (emailAccount?.isLocked) return res.status(403).json({ message: 'Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ.' });
      if (emailAccount) {
        return res.status(409).json({
          message: 'Email này đã thuộc một tài khoản CINE3D. Hãy đăng nhập bằng phương thức đã sử dụng trước đó.',
          code: 'EMAIL_ACCOUNT_EXISTS',
        });
      }
    }
    if (user?.isLocked) return res.status(403).json({ message: 'Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ.' });

    const avatar = profile.picture?.data?.url || null;
    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { facebookId, isVerified: true, avatar: user.avatar || avatar },
        include: { role: true },
      });
    } else {
      const role = await prisma.role.upsert({ where: { name: 'USER' }, update: {}, create: { name: 'USER' } });
      const username = await createAvailableUsername(profile.name || '', email);
      const password = await bcrypt.hash(crypto.randomBytes(48).toString('hex'), 10);
      user = await prisma.user.create({
        data: { facebookId, email, username, password, avatar, isVerified: true, roleId: role.id },
        include: { role: true },
      });
    }

    const session = await createSession(user, req);
    if (!isNativeClient(req)) res.cookie(REFRESH_COOKIE, session.refreshToken, cookieOptions);
    return res.json(sessionResponse(req, {
      message: 'Đăng nhập Facebook thành công.',
      accessToken: session.accessToken,
      user: session.user,
    }, session.refreshToken));
  } catch (error: unknown) {
    return internalError(res, 'Không thể hoàn tất đăng nhập Facebook.', error);
  }
};

export const refresh = async (req: AuthenticatedRequest, res: Response) => {
  const refreshToken = isNativeClient(req)
    ? req.body.refreshToken
    : getCookie(req, REFRESH_COOKIE) || req.body.refreshToken;

  if (!refreshToken) {
    return res.status(400).json({ message: 'Thiếu phiên đăng nhập.' });
  }

  try {
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: hashToken(refreshToken) },
      include: { user: { include: { role: true } } },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      if (storedToken) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      }
      return res.status(403).json({ message: 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.' });
    }

    try {
      jwt.verify(refreshToken, JWT_REFRESH_SECRET!);
    } catch {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      return res.status(403).json({ message: 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.' });
    }

    if (storedToken.user.isLocked) {
      await prisma.refreshToken.deleteMany({ where: { userId: storedToken.user.id } });
      return res.status(403).json({ message: 'Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ.' });
    }

    const payload = {
      id: storedToken.user.id,
      email: storedToken.user.email,
      username: storedToken.user.username,
      role: storedToken.user.role.name,
    };

    const accessToken = jwt.sign(payload, JWT_ACCESS_SECRET!, { expiresIn: '15m' });
    // Keep the refresh token stable until its expiry. Rotating on every refresh
    // makes concurrent tabs/app-resume requests race: the losing request sees
    // a deleted token and logs the user out. Access tokens remain short-lived.
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { lastUsedAt: new Date() },
    });

    if (!isNativeClient(req)) res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
    return res.json(sessionResponse(req, {
      accessToken,
      user: {
        id: storedToken.user.id,
        email: storedToken.user.email,
        username: storedToken.user.username,
        avatar: storedToken.user.avatar,
        role: storedToken.user.role.name,
        isVip: hasVipAccess(storedToken.user),
        vipExpiresAt: storedToken.user.vipExpiresAt,
      },
    }, refreshToken));
  } catch (error: any) {
    return internalError(res, 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.', error);
  }
};

export const logout = async (req: AuthenticatedRequest, res: Response) => {
  const refreshToken = getCookie(req, REFRESH_COOKIE) || req.body.refreshToken;

  try {
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: hashToken(refreshToken) } });
    }

    res.clearCookie(REFRESH_COOKIE, cookieClearOptions);
    return res.json({ message: 'Đã đăng xuất.' });
  } catch (error: any) {
    return internalError(res, 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.', error);
  }
};

export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Bạn cần đăng nhập để tiếp tục.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        isVerified: true,
        isVip: true,
        vipExpiresAt: true,
        role: { select: { name: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản.' });
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        isVerified: user.isVerified,
        isVip: hasVipAccess(user),
        vipExpiresAt: user.vipExpiresAt,
        role: user.role.name,
      },
    });
  } catch (error: any) {
    return internalError(res, 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.', error);
  }
};

export const forgotPassword = async (req: AuthenticatedRequest, res: Response) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email) return res.status(400).json({ message: 'Vui lòng nhập email.' });
  const botGate = await verifyBotGate(req.body.turnstileToken, req);
  if (!botGate.ok) return rejectBotGate(res, botGate);

  const genericMessage = 'If an account with that email exists, password reset instructions have been sent.';

  if (!emailDeliveryConfigured) {
    return res.status(503).json({ message: 'Khôi phục mật khẩu qua email chưa được cấu hình.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json({ message: genericMessage });
    }

    const reset = createActionToken();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: reset.tokenHash,
        passwordResetExpires: reset.expiresAt,
      },
    });

    await sendActionEmail({
      to: user.email,
      username: user.username,
      subject: 'Đặt lại mật khẩu CINE3D',
      heading: 'Khôi phục mật khẩu',
      message: 'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.',
      actionLabel: 'Đặt lại mật khẩu',
      actionUrl: `${process.env.PASSWORD_RESET_URL || `${clientUrl}/account`}?resetToken=${encodeURIComponent(reset.token)}`,
    });

    return res.json({ message: genericMessage });
  } catch (error: any) {
    return internalError(res, 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.', error);
  }
};

export const resetPassword = async (req: AuthenticatedRequest, res: Response) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Thiếu mã đặt lại mật khẩu hoặc mật khẩu mới.' });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 8 ký tự.' });
  }

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    return res.json({ message: 'Đã cập nhật mật khẩu.' });
  } catch (error: any) {
    return internalError(res, 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.', error);
  }
};

export const verifyEmail = async (req: AuthenticatedRequest, res: Response) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token) return res.redirect(`${clientUrl}/account?verified=invalid`);

  try {
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: hashToken(token),
        emailVerificationExpires: { gt: new Date() },
      },
    });
    if (!user) return res.redirect(`${clientUrl}/account?verified=invalid`);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });
    return res.redirect(`${clientUrl}/account?verified=success`);
  } catch (error: unknown) {
    console.error('Email verification failed.', error);
    return res.redirect(`${clientUrl}/account?verified=error`);
  }
};

export const verifyEmailNative = async (req: AuthenticatedRequest, res: Response) => {
  const token = typeof req.body.token === 'string' ? req.body.token.trim() : '';
  if (!token) return res.status(400).json({ message: 'Thiếu mã xác nhận email.' });

  try {
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: hashToken(token),
        emailVerificationExpires: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!user) return res.status(400).json({ message: 'Liên kết xác nhận không hợp lệ hoặc đã hết hạn.' });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });
    return res.json({
      message: 'Email đã được xác nhận.',
      verified: true,
      deepLink: process.env.MOBILE_EMAIL_VERIFIED_DEEP_LINK?.trim() || null,
    });
  } catch (error) {
    return internalError(res, 'Could not verify email.', error);
  }
};

const QR_LOGIN_TTL_MS = 2 * 60 * 1000;

function qrDeepLink(token: string) {
  const base = (process.env.CLIENT_URLS || process.env.CLIENT_URL || clientUrl)
    .split(',')[0]
    .trim()
    .replace(/\/$/, '') || clientUrl;
  return `${base}/qr-login?t=${encodeURIComponent(token)}`;
}

async function findFreshQrSession(token: string) {
  const session = await prisma.qrLoginSession.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now() && session.status === 'PENDING') {
    await prisma.qrLoginSession.update({
      where: { id: session.id },
      data: { status: 'EXPIRED' },
    });
    return { ...session, status: 'EXPIRED' };
  }
  return session;
}

/** Web creates a pending QR session shown as a scannable deep link. */
export const createQrLoginSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    const meta = getSessionMetadata(req);
    const expiresAt = new Date(Date.now() + QR_LOGIN_TTL_MS);
    const session = await prisma.qrLoginSession.create({
      data: {
        tokenHash: hashToken(token),
        expiresAt,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });
    return res.status(201).json({
      sessionId: session.id,
      token,
      expiresAt: expiresAt.toISOString(),
      expiresInSeconds: Math.floor(QR_LOGIN_TTL_MS / 1000),
      deepLink: qrDeepLink(token),
      status: 'PENDING',
    });
  } catch (error) {
    return internalError(res, 'Could not create QR login session.', error);
  }
};

/** Web polls until the mobile app approves, then claims tokens once. */
export const getQrLoginSession = async (req: AuthenticatedRequest, res: Response) => {
  const token = typeof req.params.token === 'string' ? req.params.token.trim() : '';
  if (!token || token.length < 32) return res.status(400).json({ message: 'Mã QR không hợp lệ.' });

  try {
    const session = await findFreshQrSession(token);
    if (!session) return res.status(404).json({ message: 'Phiên QR không tồn tại.', status: 'MISSING' });

    if (session.status === 'PENDING') {
      return res.json({
        status: 'PENDING',
        expiresAt: session.expiresAt.toISOString(),
        expiresInSeconds: Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000)),
      });
    }

    if (session.status === 'EXPIRED' || session.status === 'CANCELLED') {
      return res.json({ status: session.status, expiresAt: session.expiresAt.toISOString() });
    }

    if (session.status === 'USED') {
      return res.status(410).json({ status: 'USED', message: 'Mã QR đã được dùng.' });
    }

    if (session.status !== 'APPROVED' || !session.userId) {
      return res.status(409).json({ status: session.status, message: 'Phiên QR chưa sẵn sàng.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { role: true },
    });
    if (!user || user.isLocked) {
      await prisma.qrLoginSession.update({ where: { id: session.id }, data: { status: 'CANCELLED' } });
      return res.status(403).json({ status: 'CANCELLED', message: 'Tài khoản không khả dụng.' });
    }

    const claimed = await prisma.qrLoginSession.updateMany({
      where: { id: session.id, status: 'APPROVED' },
      data: { status: 'USED', usedAt: new Date() },
    });
    if (claimed.count === 0) {
      return res.status(410).json({ status: 'USED', message: 'Mã QR đã được dùng.' });
    }

    const authSession = await createSession(user, req);
    if (!isNativeClient(req)) res.cookie(REFRESH_COOKIE, authSession.refreshToken, cookieOptions);
    return res.json(sessionResponse(req, {
      status: 'APPROVED',
      accessToken: authSession.accessToken,
      user: authSession.user,
      message: 'Đăng nhập bằng QR thành công.',
    }, authSession.refreshToken));
  } catch (error) {
    return internalError(res, 'Could not read QR login session.', error);
  }
};

/** Authenticated mobile app approves the pending web QR session. */
export const approveQrLoginSession = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Vui lòng đăng nhập trên app trước.' });
  const token = typeof req.body.token === 'string' ? req.body.token.trim() : '';
  if (!token || token.length < 32) return res.status(400).json({ message: 'Mã QR không hợp lệ.' });

  try {
    const session = await findFreshQrSession(token);
    if (!session) return res.status(404).json({ message: 'Phiên QR không tồn tại hoặc đã hết hạn.' });
    if (session.status === 'EXPIRED') return res.status(410).json({ message: 'Mã QR đã hết hạn. Hãy tạo mã mới trên web.' });
    if (session.status === 'CANCELLED') return res.status(410).json({ message: 'Phiên QR đã bị hủy trên web.' });
    if (session.status === 'USED') return res.status(410).json({ message: 'Mã QR đã được dùng.' });
    if (session.status === 'APPROVED') {
      if (session.userId === req.user.id) {
        return res.json({ message: 'Đã xác nhận đăng nhập web.', status: 'APPROVED' });
      }
      return res.status(409).json({ message: 'Mã QR đã được xác nhận bởi tài khoản khác.' });
    }

    const updated = await prisma.qrLoginSession.updateMany({
      where: { id: session.id, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        userId: req.user.id,
        approvedAt: new Date(),
      },
    });
    if (updated.count === 0) {
      return res.status(409).json({ message: 'Không thể xác nhận mã QR. Thử lại với mã mới.' });
    }

    return res.json({
      message: 'Đã xác nhận. Máy tính sẽ đăng nhập trong giây lát.',
      status: 'APPROVED',
    });
  } catch (error) {
    return internalError(res, 'Could not approve QR login session.', error);
  }
};

/** Web cancels a pending QR session. */
export const cancelQrLoginSession = async (req: AuthenticatedRequest, res: Response) => {
  const token = typeof req.body.token === 'string' ? req.body.token.trim() : '';
  if (!token || token.length < 32) return res.status(400).json({ message: 'Mã QR không hợp lệ.' });

  try {
    const session = await findFreshQrSession(token);
    if (!session) return res.status(404).json({ message: 'Phiên QR không tồn tại.' });
    if (session.status !== 'PENDING' && session.status !== 'APPROVED') {
      return res.json({ message: 'Phiên QR đã kết thúc.', status: session.status });
    }
    await prisma.qrLoginSession.update({
      where: { id: session.id },
      data: { status: 'CANCELLED' },
    });
    return res.json({ message: 'Đã hủy đăng nhập QR.', status: 'CANCELLED' });
  } catch (error) {
    return internalError(res, 'Could not cancel QR login session.', error);
  }
};
