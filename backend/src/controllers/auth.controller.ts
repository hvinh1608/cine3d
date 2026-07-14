import { Response } from 'express';
import { prisma } from '../lib/prisma';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { AuthenticatedRequest } from '../middleware/auth';
import { internalError } from '../lib/http-error';
import { hasVipAccess } from '../lib/vip';
import { emailDeliveryConfigured, sendActionEmail } from '../services/email.service';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const REFRESH_COOKIE = 'cine3d_refresh';
const secureCookies = process.env.COOKIE_SECURE === 'true';
const requireEmailVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
const clientUrl = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')[0]
  .trim()
  .replace(/\/$/, '');
const cookieOptions = {
  httpOnly: true,
  secure: secureCookies,
  sameSite: (secureCookies ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
};

type SessionUser = {
  id: string;
  email: string;
  username: string;
  avatar: string | null;
  isVip: boolean;
  vipExpiresAt: Date | null;
  role: { name: string };
};

async function createSession(user: SessionUser) {
  const payload = {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role.name,
  };

  const accessToken = jwt.sign(payload, JWT_ACCESS_SECRET!, { expiresIn: '15m' });
  const refreshToken = jwt.sign(
    { ...payload, jti: crypto.randomUUID() },
    JWT_REFRESH_SECRET!,
    { expiresIn: '7d' }
  );

  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    prisma.refreshToken.create({
      data: {
        token: hashToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
if (requireEmailVerification && !emailDeliveryConfigured) {
  throw new Error('REQUIRE_EMAIL_VERIFICATION needs RESEND_API_KEY and MAIL_FROM.');
}

export const register = async (req: AuthenticatedRequest, res: Response) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const { password } = req.body;

  if (!email || !username || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ message: 'A valid email address is required.' });
  }

  if (username.length < 3 || username.length > 40) {
    return res.status(400).json({ message: 'Username must be between 3 and 40 characters.' });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  }

  try {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Username or email already exists.' });
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
      const publicApiUrl = (process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}/api`).replace(/\/$/, '');
      try {
        await sendActionEmail({
          to: user.email,
          username: user.username,
          subject: 'Xác minh tài khoản CINE3D',
          heading: 'Xác minh địa chỉ email',
          message: 'Nhấn nút bên dưới để kích hoạt tài khoản và bắt đầu sử dụng CINE3D.',
          actionLabel: 'Xác minh tài khoản',
          actionUrl: `${publicApiUrl}/auth/verify-email?token=${encodeURIComponent(verification.token)}`,
        });
      } catch (emailError) {
        console.error('Verification email delivery failed.', emailError);
        // Do not leave behind an account that can never be verified. The user
        // can safely submit the registration form again after mail recovers.
        await prisma.user.delete({ where: { id: user.id } });
        return res.status(503).json({
          message: 'Không thể gửi email xác minh lúc này. Vui lòng thử lại sau.',
        });
      }

      return res.status(201).json({
        message: 'Tài khoản đã được tạo. Vui lòng kiểm tra email để xác minh trước khi đăng nhập.',
        requiresVerification: true,
      });
    }

    const session = await createSession(user);
    res.cookie(REFRESH_COOKIE, session.refreshToken, cookieOptions);

    return res.status(201).json({
      message: 'User registered successfully.',
      accessToken: session.accessToken,
      user: session.user,
    });
  } catch (error: any) {
    return internalError(res, 'Internal server error.', error);
  }
};

export const login = async (req: AuthenticatedRequest, res: Response) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const { password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (user.isLocked) {
      return res.status(403).json({ message: 'Account is locked. Please contact support.' });
    }

    if (requireEmailVerification && !user.isVerified) {
      return res.status(403).json({
        message: 'Tài khoản chưa được xác minh. Vui lòng kiểm tra email.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const session = await createSession(user);
    res.cookie(REFRESH_COOKIE, session.refreshToken, cookieOptions);
    return res.json({
      accessToken: session.accessToken,
      user: session.user,
    });
  } catch (error: any) {
    return internalError(res, 'Internal server error.', error);
  }
};

export const refresh = async (req: AuthenticatedRequest, res: Response) => {
  const refreshToken = getCookie(req, REFRESH_COOKIE) || req.body.refreshToken;

  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token is required.' });
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
      return res.status(403).json({ message: 'Invalid or expired refresh token.' });
    }

    try {
      jwt.verify(refreshToken, JWT_REFRESH_SECRET!);
    } catch {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      return res.status(403).json({ message: 'Invalid or expired refresh token.' });
    }

    if (storedToken.user.isLocked) {
      await prisma.refreshToken.deleteMany({ where: { userId: storedToken.user.id } });
      return res.status(403).json({ message: 'Account is locked. Please contact support.' });
    }

    const payload = {
      id: storedToken.user.id,
      email: storedToken.user.email,
      username: storedToken.user.username,
      role: storedToken.user.role.name,
    };

    const accessToken = jwt.sign(payload, JWT_ACCESS_SECRET!, { expiresIn: '15m' });
    const newRefreshToken = jwt.sign(
      { ...payload, jti: crypto.randomUUID() },
      JWT_REFRESH_SECRET!,
      { expiresIn: '7d' }
    );
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.$transaction([
      prisma.refreshToken.delete({ where: { id: storedToken.id } }),
      prisma.refreshToken.create({
        data: {
          token: hashToken(newRefreshToken),
          userId: storedToken.user.id,
          expiresAt,
        },
      }),
    ]);

    res.cookie(REFRESH_COOKIE, newRefreshToken, cookieOptions);
    return res.json({
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
    });
  } catch (error: any) {
    return internalError(res, 'Internal server error.', error);
  }
};

export const logout = async (req: AuthenticatedRequest, res: Response) => {
  const refreshToken = getCookie(req, REFRESH_COOKIE) || req.body.refreshToken;

  try {
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: hashToken(refreshToken) } });
    }

    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, maxAge: undefined });
    return res.json({ message: 'Logged out successfully.' });
  } catch (error: any) {
    return internalError(res, 'Internal server error.', error);
  }
};

export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized.' });
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
      return res.status(404).json({ message: 'User not found.' });
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
    return internalError(res, 'Internal server error.', error);
  }
};

export const forgotPassword = async (req: AuthenticatedRequest, res: Response) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email) return res.status(400).json({ message: 'Email is required.' });

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
    return internalError(res, 'Internal server error.', error);
  }
};

export const resetPassword = async (req: AuthenticatedRequest, res: Response) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Reset token and new password are required.' });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });
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
      return res.status(400).json({ message: 'Invalid or expired reset token.' });
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

    return res.json({ message: 'Password updated successfully.' });
  } catch (error: any) {
    return internalError(res, 'Internal server error.', error);
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
