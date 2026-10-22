import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  authenticateDockerRunner,
} from '../middleware/dockerRunnerAuth.js';
import { dockerRunnerRateLimiter } from '../middleware/rateLimiter.js';
import {
  receiveDockerRunnerHeartbeat,
  readDockerRunnerStatus,
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

export default router;
