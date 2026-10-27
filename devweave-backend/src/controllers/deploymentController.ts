import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authenticate.js';
import * as deploymentService from '../services/deploymentService.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';

const triggerDeploymentSchema = z.object({
  environment: z.enum(['production', 'staging', 'development', 'Production', 'Staging', 'Development'], {
    errorMap: () => ({ message: 'Environment must be Production, Staging, or Development' }),
  }),
  repositoryId: z.string().optional(),
  repositoryName: z.string().optional(),
  branch: z.string().min(1, 'Branch name is required and cannot be empty'),
  commitSha: z.string().optional(),
  strategy: z.string().optional(),
});

const rollbackSchema = z.object({
  targetCommitSha: z.string().optional(),
  targetRunId: z.string().optional(),
  reason: z.string().max(500).optional(),
});

/**
 * List all configured environments with live status.
 * GET /api/v1/deployments/environments
 */
export async function getEnvironments(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const forceProbe = req.query.forceProbe === 'true';
    const environments = await deploymentService.getEnvironments(forceProbe);
    res.status(200).json({
      success: true,
      data: environments,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get detailed environment information, live pods, and rollback targets.
 * GET /api/v1/deployments/environments/:envId
 */
export async function getEnvironmentDetails(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { envId } = req.params;
    const details = await deploymentService.getEnvironmentDetails(envId);
    res.status(200).json({
      success: true,
      data: details,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List deployment history with optional filtering.
 * GET /api/v1/deployments/history
 */
export async function getDeploymentHistory(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const environment = req.query.environment as string | undefined;
    const status = req.query.status as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const history = await deploymentService.getDeploymentHistory({
      environment,
      status,
      limit,
      offset,
    });

    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Trigger an approved pipeline deployment.
 * POST /api/v1/deployments/trigger
 */
export async function triggerDeployment(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const parsed = triggerDeploymentSchema.parse(req.body);

    const record = await deploymentService.triggerDeployment({
      userId: req.user.id,
      userEmail: (req.user as any).email || `user-${req.user.id.substring(0, 8)}`,
      userRole: req.user.role,
      environment: parsed.environment,
      repositoryId: parsed.repositoryId,
      repositoryName: parsed.repositoryName,
      branch: parsed.branch,
      commitSha: parsed.commitSha,
      strategy: parsed.strategy,
    });

    res.status(201).json({
      success: true,
      data: record,
      message: `Deployment triggered successfully for ${record.environment}.`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Execute a safe, authorized rollback.
 * POST /api/v1/deployments/environments/:envId/rollback
 */
export async function rollbackDeployment(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { envId } = req.params;
    const parsed = rollbackSchema.parse(req.body || {});

    const result = await deploymentService.executeRollback({
      userId: req.user.id,
      userEmail: (req.user as any).email || `user-${req.user.id.substring(0, 8)}`,
      userRole: req.user.role,
      environment: envId,
      targetCommitSha: parsed.targetCommitSha,
      targetRunId: parsed.targetRunId,
      reason: parsed.reason,
    });

    res.status(200).json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieve deployment audit log trail.
 * GET /api/v1/deployments/audit-logs
 */
export async function getDeploymentAuditLogs(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const environment = req.query.environment as string | undefined;
    const logs = deploymentService.getDeploymentAuditLogs(environment);
    res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
}
