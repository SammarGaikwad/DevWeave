import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authenticate.js';
import * as userService from '../services/userService.js';
import { AppError } from '../middleware/errorHandler.js';

export async function getCurrentUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const user = await userService.getUserById(req.user.id);

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}
