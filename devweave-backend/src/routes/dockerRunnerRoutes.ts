import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  authenticateDockerRunner,
} from '../middleware/dockerRunnerAuth.js';
import { dockerRunnerRateLimiter } from '../middleware/rateLimiter.js';
import {
  receiveDockerRunnerHeartbeat,
  readDockerRunnerStatus,
  pollRunnerJob,
  downloadJobArchive,
  appendRunnerJobLogs,
  completeRunnerJob,
} from '../controllers/dockerRunnerController.js';

const router = Router();

router.post(
  '/heartbeat',
  dockerRunnerRateLimiter,
  authenticateDockerRunner,
  receiveDockerRunnerHeartbeat,
);

router.get(
  '/status',
  authenticate,
  readDockerRunnerStatus,
);

// Secure runner job execution protocol (outbound-only from Windows runner)
router.post(
  '/jobs/poll',
  authenticateDockerRunner,
  pollRunnerJob
);

router.get(
  '/jobs/:id/archive',
  authenticateDockerRunner,
  downloadJobArchive
);

router.post(
  '/jobs/:id/logs',
  authenticateDockerRunner,
  appendRunnerJobLogs
);

router.post(
  '/jobs/:id/complete',
  authenticateDockerRunner,
  completeRunnerJob
);

export default router;

