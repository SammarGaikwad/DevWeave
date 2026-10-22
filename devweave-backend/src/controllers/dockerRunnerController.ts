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
