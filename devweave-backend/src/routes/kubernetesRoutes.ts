import { Router } from 'express';
import {
  getClusterStatus,
  getManifestTemplates,
  getManifestTemplateById,
  generateManifest,
  validateManifest,
} from '../controllers/kubernetesController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.get('/status', authenticate, getClusterStatus);
router.get('/templates', authenticate, getManifestTemplates);
router.get('/templates/:id', authenticate, getManifestTemplateById);
router.post('/generate', authenticate, generateManifest);
router.post('/validate', authenticate, validateManifest);

export default router;
