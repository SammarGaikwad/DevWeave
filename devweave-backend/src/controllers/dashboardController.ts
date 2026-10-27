import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authenticate.js';
import { AppError } from '../middleware/errorHandler.js';
import { getDashboardSummary } from '../services/dashboardService.js';
import { z } from 'zod';

const dashboardQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d']).optional().default('7d'),
});

/**
 * GET /api/v1/dashboard/summary
 * Returns the unified live engineering dashboard state.
 */
export async function getDashboardOverview(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required to access dashboard metrics', 401);
    }

    const parseResult = dashboardQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      throw new AppError('Invalid period parameter. Supported values: 7d, 30d, 90d', 400);
    }

    const summary = await getDashboardSummary({
      userId: req.user.id,
      period: parseResult.data.period,
    });

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
}


