import { z } from 'zod';

const MAX_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

export const dockerRunnerSnapshotSchema = z.object({
  runnerId: z
    .string()
    .trim()
    .min(1, 'Runner ID cannot be empty.')
    .max(100, 'Runner ID cannot exceed 100 characters.')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Runner ID must only contain alphanumeric characters, underscores, or hyphens.',
    ),
  hostname: z
    .string()
    .trim()
    .min(1, 'Hostname cannot be empty.')
    .max(255, 'Hostname cannot exceed 255 characters.')
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      'Hostname must only contain alphanumeric characters, dots, underscores, or hyphens.',
    ),
  dockerVersion: z.string().max(100).nullable(),
  serverVersion: z.string().max(100).nullable(),
  containersRunning: z.number().int().min(0).max(100000),
  containersTotal: z.number().int().min(0).max(100000),
  imagesTotal: z.number().int().min(0).max(100000),
  reportedAt: z.string().datetime({ offset: true }),
}).strict().refine(
  (snapshot) => snapshot.containersRunning <= snapshot.containersTotal,
  {
    message: 'Running containers cannot exceed total containers.',
    path: ['containersRunning'],
  },
).refine(
  (snapshot) => {
    const reportedTime = new Date(snapshot.reportedAt).getTime();
    return Math.abs(Date.now() - reportedTime) <= MAX_DRIFT_MS;
  },
  {
    message: 'Reported timestamp is outside the acceptable time drift window (5 minutes).',
    path: ['reportedAt'],
  },
);

export type ValidatedDockerRunnerSnapshot =
  z.infer<typeof dockerRunnerSnapshotSchema>;
