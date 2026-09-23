import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authenticate.js';
import * as jenkinsService from '../services/jenkinsService.js';
import { AppError } from '../middleware/errorHandler.js';

/**
  * Trigger a new Jenkins CI/CD pipeline build
  * POST /api/v1/jenkins/build
  */
export async function triggerBuild(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await jenkinsService.triggerJenkinsBuild();
    res.status(201).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
  * Fetch status and details for a specific Jenkins build ID
  * GET /api/v1/jenkins/build/:id
  */
export async function getBuildStatus(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawId = req.params.id;

    if (!rawId || !/^\d+$/.test(rawId.trim())) {
      throw new AppError('Invalid build ID. Build ID must be a positive integer.', 400);
    }

    const buildId = parseInt(rawId.trim(), 10);
    if (isNaN(buildId) || buildId <= 0) {
      throw new AppError('Invalid build ID. Build ID must be a positive integer.', 400);
    }

    const buildDetails = await jenkinsService.getJenkinsBuildById(buildId);

    res.status(200).json({
      success: true,
      data: buildDetails,
    });
  } catch (error) {
    next(error);
  }
}
