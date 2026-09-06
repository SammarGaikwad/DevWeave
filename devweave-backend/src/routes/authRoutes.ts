import { Router } from 'express';
import { register, login, refresh, logout, logoutAll } from '../controllers/authController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.post('/refresh', authRateLimiter, refresh);
router.post('/logout', logout);
router.post('/logout-all', authenticate, logoutAll);

export default router;
