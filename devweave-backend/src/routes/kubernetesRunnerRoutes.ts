import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authenticateKubernetesRunner } from '../middleware/kubernetesRunnerAuth.js';
import { kubernetesRunnerRateLimiter } from '../middleware/rateLimiter.js';
import {
  receiveKubernetesRunnerHeartbeat,
  readKubernetesRunnerStatus,
  pollKubernetesRunnerJob,
  completeKubernetesRunnerJob,
  receiveKubernetesRunnerInventory,
} from '../controllers/kubernetesRunnerController.js';

const router = Router();

router.post(
  '/heartbeat',
  kubernetesRunnerRateLimiter,
  authenticateKubernetesRunner,
  receiveKubernetesRunnerHeartbeat,
);

router.post(
  '/inventory',
  authenticateKubernetesRunner,
  receiveKubernetesRunnerInventory,
);

router.get(
  '/status',
  authenticate,
  readKubernetesRunnerStatus,
);

router.post(
  '/jobs/poll',
  authenticateKubernetesRunner,
  pollKubernetesRunnerJob,
);

router.post(
  '/jobs/:id/complete',
  authenticateKubernetesRunner,
  completeKubernetesRunnerJob,
);

export default router;
