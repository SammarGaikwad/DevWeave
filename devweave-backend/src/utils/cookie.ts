import { Response, CookieOptions } from 'express';
import { env } from '../config/env.js';

export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

export function getRefreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, token, getRefreshCookieOptions());
}

export function clearRefreshCookie(res: Response): void {
  const options = getRefreshCookieOptions();
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path,
  });
}
