import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import adminRoutes from './adminRoutes.js';
import repositoryRoutes from './repositoryRoutes.js';
import githubRoutes from './githubRoutes.js';
import pipelineRoutes from './pipelineRoutes.js';
import jenkinsRoutes from './jenkinsRoutes.js';
import {
  getPipelineTemplates,
  getPipelineTemplateById,
  getPipelineRunStatus,
  getPipelineRunLogs,
} from '../controllers/pipelineController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// Health endpoint
router.use('/api', healthRoutes);

// V1 API endpoints
router.use('/api/v1/auth', authRoutes);
router.use('/api/v1/users', userRoutes);
router.use('/api/v1/admin', adminRoutes);
router.use('/api/v1/repositories', repositoryRoutes);
router.use('/api/v1/integrations/github', githubRoutes);
router.use('/api/v1/pipelines', pipelineRoutes);
router.use('/api/v1/jenkins', jenkinsRoutes);

// Dedicated REST routes for pipeline templates and runs
const templateRouter = Router();
templateRouter.get('/', authenticate, getPipelineTemplates);
templateRouter.get('/:id', authenticate, getPipelineTemplateById);
router.use('/api/v1/pipeline-templates', templateRouter);

const runRouter = Router();
runRouter.get('/:runId', authenticate, getPipelineRunStatus);
runRouter.get('/:runId/logs', authenticate, getPipelineRunLogs);
router.use('/api/v1/pipeline-runs', runRouter);

export default router;
