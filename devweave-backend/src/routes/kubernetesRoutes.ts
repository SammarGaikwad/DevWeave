import { Router } from 'express';
import {
  getClusterStatus,
  getManifestTemplates,
  getManifestTemplateById,
  generateManifest,
  validateManifest,
  getKubernetesInventory,
  getKubernetesAuditLogs,
  applyManifest,
  deleteResource,
  scaleResource,
  restartResource,
  getPodLogs,
  getResourceYaml,
  describeResource,
  createNamespace,
  deleteNamespace,
  revealSecret,
  createService,
} from '../controllers/kubernetesController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// Apply user authentication to all Kubernetes routes
router.use(authenticate);

// Cluster telemetry and status
router.get('/status', getClusterStatus);

// Blueprint templates & custom manifest generator/validator
router.get('/templates', getManifestTemplates);
router.get('/templates/:id', getManifestTemplateById);
router.post('/generate', generateManifest);
router.post('/validate', validateManifest);

// Live Cluster Inventory & Audit Logs
router.get('/inventory', getKubernetesInventory);
router.get('/audit-logs', getKubernetesAuditLogs);

// Manifest Operations (Create / Apply)
router.post('/apply', applyManifest);

// Workload Operations (Scale & Restart)
router.post('/workloads/scale', scaleResource);
router.post('/workloads/restart', restartResource);

// Resource Inspection & Logs
router.get('/pods/:namespace/:name/logs', getPodLogs);
router.get('/resources/:kind/:name/yaml', getResourceYaml);
router.get('/resources/:kind/:name/describe', describeResource);

// Destructive Operations
router.delete('/resources/:kind/:name', deleteResource);

// Namespace Management
router.post('/namespaces', createNamespace);
router.delete('/namespaces/:name', deleteNamespace);

// Secret Operations (Authorized reveal)
router.post('/secrets/reveal', revealSecret);

// Service Management
router.post('/services', createService);

export default router;
