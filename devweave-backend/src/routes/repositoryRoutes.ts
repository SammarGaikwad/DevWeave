import { Router } from 'express';
import { getRepositories, getRepositoryById } from '../controllers/repositoryController.js';
import {
  configureRepositoryPipeline,
  getRepositoryPipelines,
  getRepositoryPipelineRuns,
} from '../controllers/pipelineController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.get('/', authenticate, getRepositories);
router.get('/:id', authenticate, getRepositoryById);

// Pipeline management per repository
router.post('/:repositoryId/pipelines', authenticate, configureRepositoryPipeline);
router.get('/:repositoryId/pipelines', authenticate, getRepositoryPipelines);
router.get('/:repositoryId/pipeline-runs', authenticate, getRepositoryPipelineRuns);

export default router;
