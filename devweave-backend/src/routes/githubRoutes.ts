import { Router } from 'express';
import {
  initiateConnect,
  handleCallback,
  getGithubStatus,
  getGithubRepositories,
  getGithubRepositoryById,
  getGithubRepositoryBranches,
  getGithubRepositoryCommits,
  getGithubRepositoryPullRequests,
  getGithubRepositoryContents,
  getGithubRepositoryFile,
  updateGithubRepositoryFile,
  bulkUploadGithubRepositoryFiles,
  createGithubRepository,
  disconnectGithub,
} from '../controllers/githubController.js';
import { authenticate } from '../middleware/authenticate.js';
import { uploadMiddleware } from '../middleware/uploadMiddleware.js';

const router = Router();

// OAuth initiation and callback
router.get('/connect', authenticate, initiateConnect);
router.get('/callback', handleCallback);

// Connection status
router.get('/status', authenticate, getGithubStatus);

// Repository endpoints
router.get('/repositories', authenticate, getGithubRepositories);
router.post('/repositories', authenticate, createGithubRepository);
router.get('/repositories/:id', authenticate, getGithubRepositoryById);
router.get('/repositories/:id/branches', authenticate, getGithubRepositoryBranches);
router.get('/repositories/:id/commits', authenticate, getGithubRepositoryCommits);
router.get('/repositories/:id/pull-requests', authenticate, getGithubRepositoryPullRequests);

// Repository Workspace Contents, Files & Bulk Upload endpoints
router.get('/repositories/:id/contents/file', authenticate, getGithubRepositoryFile);
router.put('/repositories/:id/contents/file', authenticate, updateGithubRepositoryFile);
router.get('/repositories/:id/contents', authenticate, getGithubRepositoryContents);
router.post(
  '/repositories/:id/files',
  authenticate,
  uploadMiddleware.array('files', 100),
  bulkUploadGithubRepositoryFiles
);

// Disconnect endpoint
router.post('/disconnect', authenticate, disconnectGithub);

export default router;


