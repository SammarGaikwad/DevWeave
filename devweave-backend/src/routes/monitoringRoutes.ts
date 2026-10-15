import { Router } from 'express';
import {
  getSystemHealthSnapshot,
  getPlatformLogs,
} from '../controllers/monitoringController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.get('/health', authenticate, getSystemHealthSnapshot);
router.get('/logs', authenticate, getPlatformLogs);

export default router;
