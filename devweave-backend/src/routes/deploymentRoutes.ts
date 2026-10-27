import { Router } from 'express';
import {
  getEnvironments,
  getEnvironmentDetails,
  getDeploymentHistory,
  triggerDeployment,
  rollbackDeployment,
  getDeploymentAuditLogs,
} from '../controllers/deploymentController.js';
import { authenticate } from '../middleware/authenticate.js';
import { deploymentRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Environment endpoints
router.get('/environments', authenticate, deploymentRateLimiter, getEnvironments);
router.get('/environments/:envId', authenticate, deploymentRateLimiter, getEnvironmentDetails);
router.post('/environments/:envId/rollback', authenticate, deploymentRateLimiter, rollbackDeployment);

// History and execution endpoints
router.get('/history', authenticate, deploymentRateLimiter, getDeploymentHistory);
router.post('/trigger', authenticate, deploymentRateLimiter, triggerDeployment);

// Audit logging
router.get('/audit-logs', authenticate, deploymentRateLimiter, getDeploymentAuditLogs);

export default router;
