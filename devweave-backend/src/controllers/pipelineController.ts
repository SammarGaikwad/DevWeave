import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authenticate.js';
import * as jenkinsService from '../services/jenkinsService.js';
import * as pipelineExecutionService from '../services/pipelineExecutionService.js';
import { listPipelineTemplates, getPipelineTemplate } from '../services/pipelineTemplateRegistry.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * List all predefined pipeline templates.
 * GET /api/v1/pipeline-templates
 */
export async function getPipelineTemplates(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const templates = listPipelineTemplates();
    res.status(200).json({
      success: true,
      data: templates,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a specific pipeline template by ID.
 * GET /api/v1/pipeline-templates/:id
 */
export async function getPipelineTemplateById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const template = getPipelineTemplate(id);
    res.status(200).json({
      success: true,
      data: template,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Configure or create a pipeline for a repository.
 * POST /api/v1/repositories/:repositoryId/pipelines
 */
export async function configureRepositoryPipeline(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { repositoryId } = req.params;
    const { templateId, name, branch, config } = req.body;

    if (!templateId || typeof templateId !== 'string') {
      throw new AppError('templateId is required and must be a valid string', 400);
    }

    const pipeline = await pipelineExecutionService.configureRepositoryPipeline({
      userId: req.user.id,
      repositoryId,
      templateId,
      name,
      branch,
      config,
    });

    res.status(201).json({
      success: true,
      data: pipeline,
      message: 'Pipeline configured successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List all configured pipelines for a repository.
 * GET /api/v1/repositories/:repositoryId/pipelines
 */
export async function getRepositoryPipelines(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { repositoryId } = req.params;
    const pipelines = await pipelineExecutionService.getRepositoryPipelines(
      req.user.id,
      repositoryId
    );

    res.status(200).json({
      success: true,
      data: pipelines,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Trigger an execution run for a pipeline.
 * POST /api/v1/pipelines/:pipelineId/runs
 */
export async function triggerPipelineRun(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { pipelineId } = req.params;
    const run = await pipelineExecutionService.triggerPipelineRun(
      req.user.id,
      pipelineId
    );

    res.status(201).json({
      success: true,
      data: run,
      message: 'Pipeline run triggered successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get status and stage breakdown for a pipeline run.
 * GET /api/v1/pipeline-runs/:runId
 */
export async function getPipelineRunStatus(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { runId } = req.params;
    const run = await pipelineExecutionService.getPipelineRunStatus(
      req.user.id,
      runId
    );

    res.status(200).json({
      success: true,
      data: run,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get Jenkins console logs for a pipeline run.
 * GET /api/v1/pipeline-runs/:runId/logs
 */
export async function getPipelineRunLogs(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { runId } = req.params;
    const logData = await pipelineExecutionService.getPipelineRunLogs(
      req.user.id,
      runId
    );

    res.status(200).json({
      success: true,
      data: logData,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get execution history for a repository.
 * GET /api/v1/repositories/:repositoryId/pipeline-runs
 */
export async function getRepositoryPipelineRuns(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { repositoryId } = req.params;
    const runs = await pipelineExecutionService.getRepositoryPipelineRuns(
      req.user.id,
      repositoryId
    );

    res.status(200).json({
      success: true,
      data: runs,
    });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// Backward compatibility endpoints
// ==========================================

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
