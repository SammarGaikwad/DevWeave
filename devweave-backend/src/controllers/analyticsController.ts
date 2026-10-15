import { Request, Response, NextFunction } from 'express';
import { calculateAnalyticsOverview } from '../services/analyticsService.js';

export async function getAnalyticsOverview(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const overview = await calculateAnalyticsOverview();
    res.status(200).json({
      success: true,
      data: overview,
    });
  } catch (error) {
    next(error);
  }
}
