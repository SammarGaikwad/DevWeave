import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  getDockerInventory,
  getDockerAuditLogs,
  startContainer,
  stopContainer,
  restartContainer,
  deleteContainer,
  getContainerLogs,
  inspectContainer,
  createContainer,
  recreateContainer,
  tagImage,
  deleteImage,
  pruneDanglingImages,
  createNetwork,
  deleteNetwork,
  connectNetwork,
  disconnectNetwork,
  createVolume,
  deleteVolume,
} from '../controllers/dockerManagementController.js';

const router = Router();

// Apply auth to all management routes
router.use(authenticate);

// Global Docker inventory snapshot & audit log
router.get('/inventory', getDockerInventory);
router.get('/audit-logs', getDockerAuditLogs);

// Container CRUD & Lifecycle
router.post('/containers', createContainer);
router.post('/containers/:id/start', startContainer);
router.post('/containers/:id/stop', stopContainer);
router.post('/containers/:id/restart', restartContainer);
router.delete('/containers/:id', deleteContainer);
router.post('/containers/:id/recreate', recreateContainer);
router.get('/containers/:id/logs', getContainerLogs);
router.get('/containers/:id/inspect', inspectContainer);

// Image Management
router.post('/images/tag', tagImage);
router.delete('/images/:id', deleteImage);
router.post('/images/prune-dangling', pruneDanglingImages);

// Network Management
router.post('/networks', createNetwork);
router.delete('/networks/:id', deleteNetwork);
router.post('/networks/:id/connect', connectNetwork);
router.post('/networks/:id/disconnect', disconnectNetwork);

// Volume Management
router.post('/volumes', createVolume);
router.delete('/volumes/:name', deleteVolume);

export default router;
