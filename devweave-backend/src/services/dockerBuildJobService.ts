import crypto from 'node:crypto';
import { AppError } from '../middleware/errorHandler.js';

export type DockerBuildStatus =
  | 'QUEUED'
  | 'ANALYZING'
  | 'GENERATING'
  | 'AWAITING_APPROVAL'
  | 'BUILDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMED_OUT';

export interface BuildLogEntry {
  timestamp: string;
  stage: string;
  severity: 'info' | 'warn' | 'error';
  message: string;
}

export interface DockerBuildJob {
  id: string;
  userId: string;
  repositoryId?: string;
  repoFullName: string;
  branch: string;
  status: DockerBuildStatus;
  detectedStack?: any;
  dockerfile: string;
  dockerignore: string;
  composeFile?: string;
  imageTag: string;
  imageId?: string;
  imageSize?: string;
  logs: BuildLogEntry[];
  errorDetails?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  runnerId?: string;
  leaseExpiresAt?: number;
  cancelRequested?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Bounded in-memory store for high-frequency logs and resilience
const jobsStore = new Map<string, DockerBuildJob>();
const MAX_LOGS_PER_JOB = 2000;
const LEASE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function sanitizeLogMessage(message: string): string {
  let cleaned = message;
  cleaned = cleaned.replace(/Bearer\s+[^\s,;]+/gi, 'Bearer ********');
  cleaned = cleaned.replace(/(?:password|passwd|secret|token|apikey|api_key)\s*[:=]\s*['"]?([^'"\s,;]+)['"]?/gi, (match, val) => {
    return match.replace(val, '********');
  });
  cleaned = cleaned.replace(/ghp_[a-zA-Z0-9]{20,}/g, 'ghp_********');
  cleaned = cleaned.replace(/github_pat_[a-zA-Z0-9_]{30,}/g, 'github_pat_********');
  cleaned = cleaned.replace(/[A-Za-z]:\\Users\\[^\\]+/gi, 'C:\\Users\\***');
  cleaned = cleaned.replace(/\/home\/[^\/]+/gi, '/home/***');

  return cleaned.slice(0, 2000);
}

export function createBuildJob(params: {
  userId: string;
  repositoryId?: string;
  repoFullName: string;
  branch: string;
  imageTag: string;
  dockerfile: string;
  dockerignore?: string;
  composeFile?: string;
  detectedStack?: any;
}): DockerBuildJob {
  // Validate image tag format (e.g. repo-name:tag or name:v1)
  const tagRegex = /^[a-z0-9_.-]+:[a-z0-9_.-]+$/i;
  if (!tagRegex.test(params.imageTag)) {
    throw new AppError(
      'Invalid Docker image tag format. Must follow "name:tag" (e.g., "my-app:v1.0.0").',
      400
    );
  }

  // Check for active duplicate build for the same repo and branch
  for (const existing of jobsStore.values()) {
    if (
      existing.userId === params.userId &&
      existing.repoFullName === params.repoFullName &&
      existing.branch === params.branch &&
      (existing.status === 'QUEUED' || existing.status === 'BUILDING')
    ) {
      throw new AppError(
        `A build job for ${params.repoFullName} (${params.branch}) is already in progress (${existing.id}). Please wait or cancel the running job.`,
        409
      );
    }
  }

  const id = `build_${crypto.randomBytes(12).toString('hex')}`;
  const now = new Date().toISOString();

  const initialLogs: BuildLogEntry[] = [
    {
      timestamp: now,
      stage: 'init',
      severity: 'info',
      message: `Build job queued for ${params.repoFullName}:${params.branch} -> Tag: ${params.imageTag}`,
    },
  ];

  const job: DockerBuildJob = {
    id,
    userId: params.userId,
    repositoryId: params.repositoryId,
    repoFullName: params.repoFullName,
    branch: params.branch,
    status: 'QUEUED',
    detectedStack: params.detectedStack,
    dockerfile: params.dockerfile,
    dockerignore: params.dockerignore || '',
    composeFile: params.composeFile,
    imageTag: params.imageTag,
    logs: initialLogs,
    createdAt: now,
    updatedAt: now,
  };

  jobsStore.set(id, job);
  return job;
}

export function getBuildJobById(jobId: string, userId?: string): DockerBuildJob {
  // Check for lease timeouts
  checkAndExpireLeases();

  const job = jobsStore.get(jobId);
  if (!job) {
    throw new AppError(`Docker build job "${jobId}" not found.`, 404);
  }

  if (userId && job.userId !== userId) {
    throw new AppError('Unauthorized: You do not have permission to view this build job.', 403);
  }

  return job;
}

export function listUserBuildJobs(userId: string): DockerBuildJob[] {
  checkAndExpireLeases();
  return Array.from(jobsStore.values())
    .filter((j) => j.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function cancelBuildJob(jobId: string, userId: string): DockerBuildJob {
  const job = getBuildJobById(jobId, userId);
  if (job.status === 'SUCCEEDED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
    throw new AppError(`Cannot cancel build job with status "${job.status}".`, 400);
  }

  job.cancelRequested = true;
  job.status = 'CANCELLED';
  job.completedAt = new Date().toISOString();
  job.logs.push({
    timestamp: job.completedAt,
    stage: 'cancel',
    severity: 'warn',
    message: 'Build job was cancelled by user request.',
  });
  job.updatedAt = job.completedAt;

  return job;
}

/**
 * Called by Windows runner polling loop to claim the next available queued job.
 */
export function leaseNextQueuedJob(runnerId: string): DockerBuildJob | null {
  checkAndExpireLeases();

  for (const job of jobsStore.values()) {
    if (job.status === 'QUEUED' && !job.cancelRequested) {
      const now = Date.now();
      job.status = 'BUILDING';
      job.runnerId = runnerId;
      job.startedAt = new Date(now).toISOString();
      job.leaseExpiresAt = now + LEASE_DURATION_MS;
      job.updatedAt = new Date(now).toISOString();

      job.logs.push({
        timestamp: job.startedAt,
        stage: 'lease',
        severity: 'info',
        message: `Job leased by runner ${runnerId}. Workspace preparing...`,
      });

      return job;
    }
  }

  return null;
}

/**
 * Runner appends real-time build logs.
 */
export function appendJobLogs(
  jobId: string,
  runnerId: string,
  newLogs: Array<{ stage?: string; severity?: 'info' | 'warn' | 'error'; message: string }>
): { cancelRequested: boolean } {
  const job = jobsStore.get(jobId);
  if (!job) {
    throw new AppError(`Job "${jobId}" not found.`, 404);
  }

  if (job.runnerId && job.runnerId !== runnerId) {
    throw new AppError('Unauthorized: Runner ID mismatch.', 403);
  }

  // Extend lease on active logging
  job.leaseExpiresAt = Date.now() + LEASE_DURATION_MS;
  job.updatedAt = new Date().toISOString();

  for (const l of newLogs) {
    if (job.logs.length >= MAX_LOGS_PER_JOB) break;
    job.logs.push({
      timestamp: new Date().toISOString(),
      stage: l.stage || 'build',
      severity: l.severity || 'info',
      message: sanitizeLogMessage(l.message),
    });
  }

  return { cancelRequested: Boolean(job.cancelRequested) };
}

/**
 * Runner completes build execution.
 */
export function completeBuildJob(
  jobId: string,
  runnerId: string,
  result: {
    success: boolean;
    imageId?: string;
    imageSize?: string;
    error?: string;
    durationMs?: number;
  }
): DockerBuildJob {
  const job = jobsStore.get(jobId);
  if (!job) {
    throw new AppError(`Job "${jobId}" not found.`, 404);
  }

  if (job.runnerId && job.runnerId !== runnerId) {
    throw new AppError('Unauthorized runner ID.', 403);
  }

  const now = new Date().toISOString();
  job.completedAt = now;
  job.durationMs = result.durationMs || (job.startedAt ? Date.now() - new Date(job.startedAt).getTime() : 0);
  job.leaseExpiresAt = undefined;
  job.updatedAt = now;

  if (job.cancelRequested) {
    job.status = 'CANCELLED';
    return job;
  }

  if (result.success) {
    job.status = 'SUCCEEDED';
    job.imageId = result.imageId;
    job.imageSize = result.imageSize;
    job.logs.push({
      timestamp: now,
      stage: 'complete',
      severity: 'info',
      message: `Image built successfully! ID: ${result.imageId || 'N/A'} (Size: ${result.imageSize || 'N/A'})`,
    });
  } else {
    job.status = 'FAILED';
    job.errorDetails = result.error || 'Docker build failed with unknown error.';
    job.logs.push({
      timestamp: now,
      stage: 'error',
      severity: 'error',
      message: `Build failed: ${job.errorDetails}`,
    });
  }

  return job;
}

/**
 * Auto-expire stale leases if a runner disconnected without reporting.
 */
function checkAndExpireLeases(): void {
  const now = Date.now();
  for (const job of jobsStore.values()) {
    if (job.status === 'BUILDING' && job.leaseExpiresAt && now > job.leaseExpiresAt) {
      job.status = 'TIMED_OUT';
      job.completedAt = new Date(now).toISOString();
      job.errorDetails = 'Runner lease expired or runner disconnected before completing build.';
      job.logs.push({
        timestamp: job.completedAt,
        stage: 'timeout',
        severity: 'error',
        message: 'Build timed out: runner did not respond before lease expiration.',
      });
      job.updatedAt = job.completedAt;
    }
  }
}
