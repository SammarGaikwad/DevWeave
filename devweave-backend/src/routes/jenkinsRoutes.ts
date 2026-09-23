import { Router } from 'express';
import { triggerBuild, getBuildStatus } from '../controllers/jenkinsController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// POST /api/v1/jenkins/build - Trigger new build
router.post('/build', authenticate, triggerBuild);

// GET /api/v1/jenkins/build/:id - Fetch build status by ID
router.get('/build/:id', authenticate, getBuildStatus);

export default router;
