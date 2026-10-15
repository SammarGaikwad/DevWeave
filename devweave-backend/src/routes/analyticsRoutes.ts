import { Router } from 'express';
import { getAnalyticsOverview } from '../controllers/analyticsController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.get('/overview', authenticate, getAnalyticsOverview);

export default router;
