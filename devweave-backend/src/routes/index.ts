import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import adminRoutes from './adminRoutes.js';
import repositoryRoutes from './repositoryRoutes.js';
import githubRoutes from './githubRoutes.js';

const router = Router();

// Health endpoint
router.use('/api', healthRoutes);

// V1 API endpoints
router.use('/api/v1/auth', authRoutes);
router.use('/api/v1/users', userRoutes);
router.use('/api/v1/admin', adminRoutes);
router.use('/api/v1/repositories', repositoryRoutes);
router.use('/api/v1/integrations/github', githubRoutes);

export default router;
