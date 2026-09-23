import { Router } from 'express';
import {
  getPipelineStatus,
  getPipelineBuilds,
  triggerPipeline,
} from '../controllers/pipelineController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.get('/status', authenticate, getPipelineStatus);
router.get('/builds', authenticate, getPipelineBuilds);
router.post('/trigger', authenticate, triggerPipeline);

export default router;
