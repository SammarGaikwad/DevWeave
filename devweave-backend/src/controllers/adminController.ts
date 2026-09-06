import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authenticate.js';
import { prisma } from '../config/database.js';
import { sanitizeUser } from '../services/userService.js';
import { User } from '@prisma/client';

export async function getUsers(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let users: User[] = [];
    try {
      users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      // Database offline
    }

    const safeUsers = users.map(sanitizeUser);

    res.status(200).json({
      success: true,
      data: safeUsers,
    });
  } catch (error) {
    next(error);
  }
}
