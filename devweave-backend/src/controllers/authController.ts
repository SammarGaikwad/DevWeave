import { Request, Response, NextFunction } from 'express';
import { registerSchema, loginSchema } from '../schemas/authSchema.js';
import * as authService from '../services/authService.js';
import { setRefreshCookie, clearRefreshCookie, REFRESH_TOKEN_COOKIE_NAME } from '../utils/cookie.js';
import { AuthenticatedRequest } from '../middleware/authenticate.js';
import { AppError } from '../middleware/errorHandler.js';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validatedInput = registerSchema.parse(req.body);
    const user = await authService.register(validatedInput);

    res.status(201).json({
      success: true,
      data: { user },
      message: 'Account registered successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validatedInput = loginSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await authService.login(validatedInput);

    // Set HttpOnly refresh token cookie
    setRefreshCookie(res, refreshToken);

    res.status(200).json({
      success: true,
      data: {
        user,
        accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || req.body?.refreshToken;
    if (!rawRefreshToken) {
      throw new AppError('Refresh token required', 401);
    }

    const { accessToken, newRefreshToken } = await authService.refresh(rawRefreshToken);

    // Rotate refresh cookie
    setRefreshCookie(res, newRefreshToken);

    res.status(200).json({
      success: true,
      data: {
        accessToken,
      },
    });
  } catch (error) {
    clearRefreshCookie(res);
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || req.body?.refreshToken;
    await authService.logout(rawRefreshToken);

    clearRefreshCookie(res);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    clearRefreshCookie(res);
    next(error);
  }
}

export async function logoutAll(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    await authService.logoutAll(req.user.id);
    clearRefreshCookie(res);

    res.status(200).json({
      success: true,
      message: 'Logged out of all sessions successfully.',
    });
  } catch (error) {
    next(error);
  }
}
