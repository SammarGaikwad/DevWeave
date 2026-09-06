import { Router } from 'express';
import { getRepositories, getRepositoryById } from '../controllers/repositoryController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.get('/', authenticate, getRepositories);
router.get('/:id', authenticate, getRepositoryById);

export default router;
