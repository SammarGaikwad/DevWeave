import { Router } from 'express';
import {
  getDiagnosticProviderStatus,
  diagnosePipelineFailure,
  chatWithAI,
} from '../controllers/aiController.js';
import { authenticate } from '../middleware/authenticate.js';
import { aiChatRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.get('/status', authenticate, getDiagnosticProviderStatus);
router.post('/diagnose', authenticate, diagnosePipelineFailure);
router.post('/chat', authenticate, aiChatRateLimiter, chatWithAI);

export default router;
