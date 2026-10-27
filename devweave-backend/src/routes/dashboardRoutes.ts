import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { dashboardRateLimiter } from '../middleware/rateLimiter.js';
import { getDashboardOverview } from '../controllers/dashboardController.js';

const router = Router();

// Apply auth & rate limiter
router.use(authenticate);
router.use(dashboardRateLimiter);

// Dashboard summary
router.get('/summary', getDashboardOverview);

export default router;
