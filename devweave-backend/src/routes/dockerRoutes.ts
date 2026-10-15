import { Router } from 'express';
import {
  getDockerStatus,
  getDockerTemplates,
  getDockerTemplateById,
  generateCustomDockerfile,
} from '../controllers/dockerController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.get('/status', authenticate, getDockerStatus);
router.get('/templates', authenticate, getDockerTemplates);
router.get('/templates/:id', authenticate, getDockerTemplateById);
router.post('/generate', authenticate, generateCustomDockerfile);

export default router;
