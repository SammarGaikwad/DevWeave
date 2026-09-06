import { Request, Response, NextFunction } from 'express';
import { Role } from '../generated/prisma/enums.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { AppError } from './errorHandler.js';

export interface AuthenticatedUser {
  id: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication required. Missing token.', 401));
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
    };
    next();
  } catch {
    return next(new AppError('Invalid or expired access token', 401));
  }
}
