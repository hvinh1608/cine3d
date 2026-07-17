import type { CookieOptions } from 'express';

export const REFRESH_COOKIE_NAME = 'cine3d_refresh';
export const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Keep the refresh token host-only and scoped to auth endpoints. A production
 * frontend can be hosted on a genuinely cross-site domain (for example a
 * Vercel domain talking to the public API), which requires SameSite=None.
 */
export function getRefreshCookieOptions(env: NodeJS.ProcessEnv = process.env): CookieOptions {
  const secure = env.NODE_ENV === 'production' || env.COOKIE_SECURE === 'true';

  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: '/api/auth',
    priority: 'high',
  };
}

export function getRefreshCookieClearOptions(env: NodeJS.ProcessEnv = process.env): CookieOptions {
  const { maxAge: _maxAge, ...options } = getRefreshCookieOptions(env);
  return options;
}
