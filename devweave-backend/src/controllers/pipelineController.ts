import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authenticate.js';
import * as jenkinsService from '../services/jenkinsService.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Get overall pipeline status, latest build status, and stages
 */
export async function getPipelineStatus(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const status = await jenkinsService.getJenkinsPipelineStatus();
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    next(new AppError(error.message || 'Failed to fetch pipeline status from Jenkins', 502));
  }
}

/**
 * Get list of build history
 */
export async function getPipelineBuilds(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const status = await jenkinsService.getJenkinsPipelineStatus();
    res.status(200).json({
      success: true,
      data: status.builds,
    });
  } catch (error: any) {
    next(new AppError(error.message || 'Failed to fetch build history from Jenkins', 502));
  }
}

/**
 * Trigger a new Jenkins CI/CD pipeline build
 */
export async function triggerPipeline(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await jenkinsService.triggerJenkinsPipeline();
    res.status(200).json({
      success: true,
      message: result.message,
      data: { buildUrl: result.buildUrl },
    });
  } catch (error: any) {
    next(new AppError(error.message || 'Failed to trigger Jenkins pipeline', 502));
  }
}
