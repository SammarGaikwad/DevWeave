import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { kubernetesRunnerSnapshotSchema } from '../schemas/kubernetesSchema.js';
import {
  getKubernetesRunnerSnapshot,
  saveKubernetesRunnerSnapshot,
} from '../services/kubernetesRunnerService.js';
import {
  leaseNextKubernetesJob,
  completeKubernetesJob,
  updateKubernetesInventory,
} from '../services/kubernetesManagementService.js';

export function receiveKubernetesRunnerHeartbeat(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const parsed = kubernetesRunnerSnapshotSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Invalid Kubernetes runner heartbeat.',
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  const expectedRunnerId = env.KUBERNETES_RUNNER_ID || env.DOCKER_RUNNER_ID;
  if (expectedRunnerId && parsed.data.runnerId !== expectedRunnerId) {
    res.status(403).json({
      success: false,
      message: 'Unauthorized Kubernetes runner ID.',
    });
    return;
  }

  try {
    saveKubernetesRunnerSnapshot(parsed.data);
    res.status(202).json({
      success: true,
      message: 'Kubernetes runner heartbeat accepted.',
    });
  } catch (error) {
    next(error);
  }
}

export function readKubernetesRunnerStatus(
  _req: Request,
  res: Response,
): void {
  res.status(200).json({
    success: true,
    data: getKubernetesRunnerSnapshot(),
  });
}

export function receiveKubernetesRunnerInventory(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const inventory = req.body;
    if (!inventory || typeof inventory !== 'object') {
      res.status(400).json({
        success: false,
        message: 'Invalid inventory payload.',
      });
      return;
    }

    updateKubernetesInventory(inventory);
    res.status(200).json({
      success: true,
      message: 'Kubernetes inventory snapshot recorded.',
    });
  } catch (error) {
    next(error);
  }
}

export function pollKubernetesRunnerJob(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const expectedRunnerId = env.KUBERNETES_RUNNER_ID || env.DOCKER_RUNNER_ID;
    if (expectedRunnerId && req.body?.runnerId && req.body.runnerId !== expectedRunnerId) {
      res.status(403).json({
        success: false,
        message: 'Unauthorized runner ID.',
      });
      return;
    }

    const job = leaseNextKubernetesJob();
    if (job) {
      res.status(200).json({
        success: true,
        data: {
          id: job.id,
          jobType: job.jobType,
          actionType: job.actionType,
          params: job.params,
        },
      });
      return;
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export function completeKubernetesRunnerJob(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const { id } = req.params;
  const { success, data, error } = req.body;

  try {
    completeKubernetesJob(id, {
      success: Boolean(success),
      data,
      error,
    });

    res.status(200).json({
      success: true,
      message: `Kubernetes job ${id} completion recorded.`,
    });
  } catch (err) {
    next(err);
  }
}
