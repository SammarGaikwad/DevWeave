import { Router } from 'express';
import {
  getDockerStatus,
  getDockerTemplates,
  getDockerTemplateById,
  generateCustomDockerfile,
} from '../controllers/dockerController.js';
import {
  analyzeRepository,
  generateConfiguration,
  createBuild,
  getBuild,
  getBuildLogs,
  listBuilds,
  cancelBuild,
} from '../controllers/dockerBuildController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.get('/status', authenticate, getDockerStatus);
router.get('/templates', authenticate, getDockerTemplates);
router.get('/templates/:id', authenticate, getDockerTemplateById);
router.post('/generate', authenticate, generateCustomDockerfile);

// One-Click Dockerization Platform Routes
router.post('/analyze', authenticate, analyzeRepository);
router.post('/generate-config', authenticate, generateConfiguration);
router.post('/builds', authenticate, createBuild);
router.get('/builds', authenticate, listBuilds);
router.get('/builds/:id', authenticate, getBuild);
router.get('/builds/:id/logs', authenticate, getBuildLogs);
router.post('/builds/:id/cancel', authenticate, cancelBuild);

export default router;

