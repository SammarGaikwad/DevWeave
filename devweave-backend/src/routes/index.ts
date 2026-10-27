import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import adminRoutes from './adminRoutes.js';
import repositoryRoutes from './repositoryRoutes.js';
import githubRoutes from './githubRoutes.js';
import pipelineRoutes from './pipelineRoutes.js';
import jenkinsRoutes from './jenkinsRoutes.js';
import dockerRoutes from './dockerRoutes.js';
import dockerManagementRoutes from './dockerManagementRoutes.js';
import dockerRunnerRoutes from './dockerRunnerRoutes.js';
import kubernetesRunnerRoutes from './kubernetesRunnerRoutes.js';
import kubernetesRoutes from './kubernetesRoutes.js';
import monitoringRoutes from './monitoringRoutes.js';
import aiRoutes from './aiRoutes.js';
import analyticsRoutes from './analyticsRoutes.js';
import settingsRoutes from './settingsRoutes.js';
import deploymentRoutes from './deploymentRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
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
router.use('/api/v1/docker/manage', dockerManagementRoutes);
router.use('/api/v1/docker/runner', dockerRunnerRoutes);
router.use('/api/v1/docker', dockerRoutes);
router.use('/api/v1/kubernetes/runner', kubernetesRunnerRoutes);
router.use('/api/v1/kubernetes', kubernetesRoutes);
router.use('/api/v1/monitoring', monitoringRoutes);
router.use('/api/v1/ai', aiRoutes);
router.use('/api/v1/analytics', analyticsRoutes);
router.use('/api/v1/settings', settingsRoutes);
router.use('/api/v1/deployments', deploymentRoutes);
router.use('/api/v1/dashboard', dashboardRoutes);


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
