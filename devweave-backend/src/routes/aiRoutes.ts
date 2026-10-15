import { Router } from 'express';
import {
  getDiagnosticProviderStatus,
  diagnosePipelineFailure,
} from '../controllers/aiController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.get('/status', authenticate, getDiagnosticProviderStatus);
router.post('/diagnose', authenticate, diagnosePipelineFailure);

export default router;
