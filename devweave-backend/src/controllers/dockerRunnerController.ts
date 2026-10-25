import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import {
  dockerRunnerSnapshotSchema,
} from '../schemas/dockerRunnerSchema.js';
import {
  getRunnerSnapshot,
  saveRunnerSnapshot,
} from '../services/dockerRunnerService.js';

export function receiveDockerRunnerHeartbeat(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const parsed = dockerRunnerSnapshotSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Invalid Docker runner heartbeat.',
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  if (env.DOCKER_RUNNER_ID && parsed.data.runnerId !== env.DOCKER_RUNNER_ID) {
    res.status(403).json({
      success: false,
      message: 'Unauthorized runner ID.',
    });
    return;
  }

  try {
    saveRunnerSnapshot(parsed.data);
    res.status(202).json({
      success: true,
      message: 'Docker runner heartbeat accepted.',
    });
  } catch (error) {
    next(error);
  }
}

export function readDockerRunnerStatus(
  _req: Request,
  res: Response,
): void {
  res.status(200).json({
    success: true,
    data: getRunnerSnapshot(),
  });
}

import {
  leaseNextQueuedJob,
  appendJobLogs,
  completeBuildJob,
  getBuildJobById,
} from '../services/dockerBuildJobService.js';
import { streamJobArchive } from '../services/dockerArchiveService.js';

export function pollRunnerJob(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const runnerId = (req.body?.runnerId as string) || env.DOCKER_RUNNER_ID || 'windows-docker-runner';
    const job = leaseNextQueuedJob(runnerId);

    res.status(200).json({
      success: true,
      data: job ? {
        id: job.id,
        repoFullName: job.repoFullName,
        branch: job.branch,
        imageTag: job.imageTag,
        dockerfile: job.dockerfile,
        dockerignore: job.dockerignore,
        composeFile: job.composeFile,
        timeoutSeconds: 300,
      } : null,
    });
  } catch (error) {
    next(error);
  }
}

export async function downloadJobArchive(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const job = getBuildJobById(id);

    await streamJobArchive(job, res);
  } catch (error) {
    next(error);
  }
}

export function appendRunnerJobLogs(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const { id } = req.params;
    const runnerId = (req.body?.runnerId as string) || env.DOCKER_RUNNER_ID || 'windows-docker-runner';
    const logs = Array.isArray(req.body?.logs) ? req.body.logs : [];

    const result = appendJobLogs(id, runnerId, logs);

    res.status(200).json({
      success: true,
      cancelRequested: result.cancelRequested,
    });
  } catch (error) {
    next(error);
  }
}

export function completeRunnerJob(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const { id } = req.params;
    const runnerId = (req.body?.runnerId as string) || env.DOCKER_RUNNER_ID || 'windows-docker-runner';
    const { success, imageId, imageSize, error, durationMs } = req.body;

    const job = completeBuildJob(id, runnerId, {
      success: Boolean(success),
      imageId,
      imageSize,
      error,
      durationMs,
    });

    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    next(error);
  }
}

