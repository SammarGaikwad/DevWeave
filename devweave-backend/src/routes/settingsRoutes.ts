import { Router } from 'express';
import { getSettingsOverview } from '../controllers/settingsController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.get('/overview', authenticate, getSettingsOverview);

export default router;
