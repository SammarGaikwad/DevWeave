import { Router } from 'express';
import {
  getPipelineStatus,
  getPipelineBuilds,
  triggerPipeline,
  getPipelineTemplates,
  getPipelineTemplateById,
  triggerPipelineRun,
  getPipelineRunStatus,
  getPipelineRunLogs,
} from '../controllers/pipelineController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// Templates
router.get('/templates', authenticate, getPipelineTemplates);
router.get('/templates/:id', authenticate, getPipelineTemplateById);

// Execution triggers
router.post('/:pipelineId/runs', authenticate, triggerPipelineRun);

// Run inspection
router.get('/runs/:runId', authenticate, getPipelineRunStatus);
router.get('/runs/:runId/logs', authenticate, getPipelineRunLogs);

// Backward-compatible endpoints for existing Jenkins job integration
router.get('/status', authenticate, getPipelineStatus);
router.get('/builds', authenticate, getPipelineBuilds);
router.post('/trigger', authenticate, triggerPipeline);

export default router;
