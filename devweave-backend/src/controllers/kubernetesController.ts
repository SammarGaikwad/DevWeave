import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authenticate.js';
import {
  checkClusterStatus,
  K8S_TEMPLATES,
  generateCustomManifest,
  validateK8sYaml,
  K8sCustomOptions,
} from '../services/kubernetesService.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';
import {
  getKubernetesInventory as fetchK8sInventory,
  executeKubernetesAction,
} from '../services/kubernetesManagementService.js';
import {
  getKubernetesAuditLogs as fetchK8sAuditLogs,
  assertServiceCreationAllowed,
} from '../services/kubernetesProtectionService.js';
import YAML from 'yaml';
import {
  k8sApplyManifestSchema,
  k8sDeleteResourceSchema,
  k8sScaleResourceSchema,
  k8sRestartResourceSchema,
  k8sGetLogsSchema,
  k8sCreateNamespaceSchema,
  k8sRevealSecretSchema,
  k8sCreateServiceSchema,
  k8sCreateDeploymentSchema,
  k8sCreateConfigMapSchema,
  k8sCreateSecretSchema,
  k8sCreatePvcSchema,
  k8sCreateIngressSchema,
  k8sCronJobSuspendSchema,
  k8sCronJobTriggerSchema,
} from '../schemas/kubernetesSchema.js';

const generateK8sSchema = z.object({
  serviceName: z.string().min(1).default('devweave-service'),
  namespace: z.string().default('default'),
  imageTag: z.string().default('devweave/service:latest'),
  containerPort: z.number().int().min(1).max(65535).default(8080),
  replicas: z.number().int().min(1).max(50).default(3),
  cpuRequest: z.string().default('100m'),
  cpuLimit: z.string().default('500m'),
  memoryRequest: z.string().default('128Mi'),
  memoryLimit: z.string().default('512Mi'),
  enableIngress: z.boolean().default(true),
  ingressHost: z.string().default('app.devweave.internal'),
  enableHpa: z.boolean().default(true),
  minReplicas: z.number().int().min(1).default(2),
  maxReplicas: z.number().int().min(2).default(10),
});

const validateSchema = z.object({
  yaml: z.string().min(1, 'YAML content is required.'),
});

export async function getClusterStatus(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const status = await checkClusterStatus();
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
}

export function getManifestTemplates(_req: Request, res: Response): void {
  const list = Object.values(K8S_TEMPLATES).map((t) => ({
    id: t.id,
    name: t.name,
    kind: t.kind,
    apiVersion: t.apiVersion,
    description: t.description,
    bestPractices: t.bestPractices,
  }));

  res.status(200).json({
    success: true,
    data: list,
  });
}

export function getManifestTemplateById(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { id } = req.params;
  const template = K8S_TEMPLATES[id];

  if (!template) {
    return next(new AppError(`Kubernetes template "${id}" not found.`, 404));
  }

  res.status(200).json({
    success: true,
    data: template,
  });
}

export function generateManifest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const parsed = generateK8sSchema.parse(req.body) as K8sCustomOptions;
    const yaml = generateCustomManifest(parsed);

    res.status(200).json({
      success: true,
      data: {
        yaml,
        options: parsed,
      },
    });
  } catch (error) {
    next(error);
  }
}

export function validateManifest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const parsed = validateSchema.parse(req.body);
    const result = validateK8sYaml(parsed.yaml);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------------
// Live Kubernetes Cluster Inventory & Management Controllers
// -------------------------------------------------------------

export function getKubernetesInventory(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const snapshot = fetchK8sInventory();
    res.status(200).json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    next(error);
  }
}

export function getKubernetesAuditLogs(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const logs = fetchK8sAuditLogs();
    res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
}

export async function applyManifest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = k8sApplyManifestSchema.parse(req.body);
    const validation = validateK8sYaml(parsed.yaml);
    if (!validation.valid) {
      res.status(400).json({
        success: false,
        message: 'Manifest validation failed.',
        errors: validation.errors,
      });
      return;
    }

    const result = await executeKubernetesAction(
      'K8S_APPLY_MANIFEST',
      parsed,
      { id: req.user!.id },
      45_000
    );

    res.status(200).json({
      success: true,
      message: 'Kubernetes manifest applied successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteResource(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { kind, name } = req.params;
    const namespace = (req.query.namespace as string) || (req.body?.namespace as string) || undefined;
    const parsed = k8sDeleteResourceSchema.parse({ kind, name, namespace });

    const result = await executeKubernetesAction(
      'K8S_DELETE_RESOURCE',
      parsed,
      { id: req.user!.id },
      30_000
    );

    res.status(200).json({
      success: true,
      message: `Resource "${kind}/${name}" deleted successfully.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function scaleResource(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = k8sScaleResourceSchema.parse(req.body);
    const result = await executeKubernetesAction(
      'K8S_SCALE_RESOURCE',
      parsed,
      { id: req.user!.id },
      30_000
    );

    res.status(200).json({
      success: true,
      message: `${parsed.kind} "${parsed.name}" scaled to ${parsed.replicas} replicas.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function restartResource(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = k8sRestartResourceSchema.parse(req.body);
    const result = await executeKubernetesAction(
      'K8S_RESTART_RESOURCE',
      parsed,
      { id: req.user!.id },
      30_000
    );

    res.status(200).json({
      success: true,
      message: `Rollout restart triggered for ${parsed.kind} "${parsed.name}".`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getPodLogs(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { namespace, name } = req.params;
    const container = req.query.container as string | undefined;
    const tailLines = req.query.tailLines ? parseInt(req.query.tailLines as string, 10) : 100;
    const timestamps = req.query.timestamps === 'true';

    const parsed = k8sGetLogsSchema.parse({
      podName: name,
      namespace,
      container,
      tailLines,
      timestamps,
    });

    const result = await executeKubernetesAction(
      'K8S_GET_LOGS',
      parsed,
      { id: req.user!.id },
      30_000
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getResourceYaml(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { kind, name } = req.params;
    const namespace = req.query.namespace as string | undefined;

    const result = await executeKubernetesAction(
      'K8S_GET_RESOURCE_YAML',
      { kind, name, namespace },
      { id: req.user!.id },
      25_000
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function describeResource(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { kind, name } = req.params;
    const namespace = req.query.namespace as string | undefined;

    const result = await executeKubernetesAction(
      'K8S_GET_DESCRIBE',
      { kind, name, namespace },
      { id: req.user!.id },
      25_000
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function createNamespace(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = k8sCreateNamespaceSchema.parse(req.body);
    const result = await executeKubernetesAction(
      'K8S_CREATE_NAMESPACE',
      parsed,
      { id: req.user!.id },
      25_000
    );

    res.status(201).json({
      success: true,
      message: `Namespace "${parsed.name}" created successfully.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteNamespace(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name } = req.params;
    const result = await executeKubernetesAction(
      'K8S_DELETE_NAMESPACE',
      { name },
      { id: req.user!.id },
      30_000
    );

    res.status(200).json({
      success: true,
      message: `Namespace "${name}" deleted successfully.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function revealSecret(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = k8sRevealSecretSchema.parse(req.body);
    const result = await executeKubernetesAction(
      'K8S_REVEAL_SECRET',
      parsed,
      { id: req.user!.id },
      20_000
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function createService(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = k8sCreateServiceSchema.parse(req.body);
    assertServiceCreationAllowed(parsed.name, parsed.namespace);

    const portName = parsed.portName || (parsed.port === 80 ? 'http' : parsed.port === 443 ? 'https' : 'service-port');

    const serviceManifestObj = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: parsed.name,
        namespace: parsed.namespace,
        labels: {
          'app.kubernetes.io/name': parsed.name,
          'app.kubernetes.io/managed-by': 'devweave',
        },
      },
      spec: {
        type: parsed.type,
        selector: parsed.selector,
        ports: [
          {
            name: portName,
            protocol: parsed.protocol,
            port: parsed.port,
            targetPort: parsed.targetPort,
          },
        ],
      },
    };

    const manifestYaml = YAML.stringify(serviceManifestObj);

    const validation = validateK8sYaml(manifestYaml);
    if (!validation.valid) {
      res.status(400).json({
        success: false,
        message: 'Generated service manifest validation failed.',
        errors: validation.errors,
      });
      return;
    }

    const result = await executeKubernetesAction(
      'K8S_APPLY_MANIFEST',
      { yaml: manifestYaml, namespace: parsed.namespace },
      { id: req.user!.id },
      30_000
    );

    res.status(201).json({
      success: true,
      message: `Service "${parsed.name}" created successfully in namespace "${parsed.namespace}".`,
      data: {
        created: true,
        name: parsed.name,
        namespace: parsed.namespace,
        output: result?.output || 'Service created.',
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createDeployment(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = k8sCreateDeploymentSchema.parse(req.body);
    const deployObj = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: parsed.name,
        namespace: parsed.namespace,
        labels: {
          app: parsed.name,
          'app.kubernetes.io/name': parsed.name,
          'app.kubernetes.io/managed-by': 'devweave',
          ...(parsed.labels || {}),
        },
      },
      spec: {
        replicas: parsed.replicas,
        selector: {
          matchLabels: {
            app: parsed.name,
          },
        },
        template: {
          metadata: {
            labels: {
              app: parsed.name,
              ...(parsed.labels || {}),
            },
          },
          spec: {
            containers: [
              {
                name: 'app',
                image: parsed.image,
                ports: [{ containerPort: parsed.port, name: 'http' }],
                resources: {
                  requests: {
                    cpu: parsed.cpuRequest,
                    memory: parsed.memoryRequest,
                  },
                  limits: {
                    cpu: parsed.cpuLimit,
                    memory: parsed.memoryLimit,
                  },
                },
                env: parsed.env && parsed.env.length > 0 ? parsed.env : undefined,
              },
            ],
          },
        },
      },
    };

    const manifestYaml = YAML.stringify(deployObj);
    const validation = validateK8sYaml(manifestYaml);
    if (!validation.valid) {
      res.status(400).json({
        success: false,
        message: 'Generated Deployment manifest validation failed.',
        errors: validation.errors,
      });
      return;
    }

    const result = await executeKubernetesAction(
      'K8S_APPLY_MANIFEST',
      { yaml: manifestYaml, namespace: parsed.namespace },
      { id: req.user!.id },
      30_000
    );

    res.status(201).json({
      success: true,
      message: `Deployment "${parsed.name}" created successfully in namespace "${parsed.namespace}".`,
      data: {
        created: true,
        name: parsed.name,
        namespace: parsed.namespace,
        output: result?.output || 'Deployment created.',
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createConfigMap(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = k8sCreateConfigMapSchema.parse(req.body);
    const cmObj = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: parsed.name,
        namespace: parsed.namespace,
        labels: {
          'app.kubernetes.io/managed-by': 'devweave',
        },
      },
      data: parsed.data,
    };

    const manifestYaml = YAML.stringify(cmObj);
    const validation = validateK8sYaml(manifestYaml);
    if (!validation.valid) {
      res.status(400).json({
        success: false,
        message: 'Generated ConfigMap validation failed.',
        errors: validation.errors,
      });
      return;
    }

    const result = await executeKubernetesAction(
      'K8S_APPLY_MANIFEST',
      { yaml: manifestYaml, namespace: parsed.namespace },
      { id: req.user!.id },
      30_000
    );

    res.status(201).json({
      success: true,
      message: `ConfigMap "${parsed.name}" created successfully in namespace "${parsed.namespace}".`,
      data: {
        created: true,
        name: parsed.name,
        namespace: parsed.namespace,
        output: result?.output || 'ConfigMap created.',
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createSecret(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = k8sCreateSecretSchema.parse(req.body);
    const encodedData: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed.data)) {
      encodedData[k] = Buffer.from(v, 'utf8').toString('base64');
    }

    const secretObj = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: parsed.name,
        namespace: parsed.namespace,
        labels: {
          'app.kubernetes.io/managed-by': 'devweave',
        },
      },
      type: parsed.type,
      data: encodedData,
    };

    const manifestYaml = YAML.stringify(secretObj);
    const validation = validateK8sYaml(manifestYaml);
    if (!validation.valid) {
      res.status(400).json({
        success: false,
        message: 'Generated Secret validation failed.',
        errors: validation.errors,
      });
      return;
    }

    const result = await executeKubernetesAction(
      'K8S_APPLY_MANIFEST',
      { yaml: manifestYaml, namespace: parsed.namespace },
      { id: req.user!.id },
      30_000
    );

    res.status(201).json({
      success: true,
      message: `Secret "${parsed.name}" created successfully in namespace "${parsed.namespace}".`,
      data: {
        created: true,
        name: parsed.name,
        namespace: parsed.namespace,
        output: result?.output || 'Secret created.',
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createPvc(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = k8sCreatePvcSchema.parse(req.body);
    const pvcObj: any = {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: {
        name: parsed.name,
        namespace: parsed.namespace,
        labels: {
          'app.kubernetes.io/managed-by': 'devweave',
        },
      },
      spec: {
        accessModes: parsed.accessModes,
        resources: {
          requests: {
            storage: parsed.storage,
          },
        },
      },
    };
    if (parsed.storageClass) {
      pvcObj.spec.storageClassName = parsed.storageClass;
    }

    const manifestYaml = YAML.stringify(pvcObj);
    const validation = validateK8sYaml(manifestYaml);
    if (!validation.valid) {
      res.status(400).json({
        success: false,
        message: 'Generated PVC validation failed.',
        errors: validation.errors,
      });
      return;
    }

    const result = await executeKubernetesAction(
      'K8S_APPLY_MANIFEST',
      { yaml: manifestYaml, namespace: parsed.namespace },
      { id: req.user!.id },
      30_000
    );

    res.status(201).json({
      success: true,
      message: `PersistentVolumeClaim "${parsed.name}" created successfully in namespace "${parsed.namespace}".`,
      data: {
        created: true,
        name: parsed.name,
        namespace: parsed.namespace,
        output: result?.output || 'PVC created.',
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createIngress(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = k8sCreateIngressSchema.parse(req.body);
    const ingressObj = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: parsed.name,
        namespace: parsed.namespace,
        labels: {
          'app.kubernetes.io/managed-by': 'devweave',
        },
      },
      spec: {
        ingressClassName: parsed.ingressClassName,
        rules: [
          {
            host: parsed.host,
            http: {
              paths: [
                {
                  path: parsed.path,
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: parsed.serviceName,
                      port: {
                        number: parsed.servicePort,
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    };

    const manifestYaml = YAML.stringify(ingressObj);
    const validation = validateK8sYaml(manifestYaml);
    if (!validation.valid) {
      res.status(400).json({
        success: false,
        message: 'Generated Ingress validation failed.',
        errors: validation.errors,
      });
      return;
    }

    const result = await executeKubernetesAction(
      'K8S_APPLY_MANIFEST',
      { yaml: manifestYaml, namespace: parsed.namespace },
      { id: req.user!.id },
      30_000
    );

    res.status(201).json({
      success: true,
      message: `Ingress "${parsed.name}" created successfully in namespace "${parsed.namespace}".`,
      data: {
        created: true,
        name: parsed.name,
        namespace: parsed.namespace,
        output: result?.output || 'Ingress created.',
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function suspendCronJob(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = k8sCronJobSuspendSchema.parse(req.body);
    const result = await executeKubernetesAction(
      'K8S_PATCH_CRONJOB_SUSPEND',
      parsed,
      { id: req.user!.id },
      20_000
    );

    res.status(200).json({
      success: true,
      message: `CronJob "${parsed.name}" ${parsed.suspend ? 'suspended' : 'resumed'} successfully.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function triggerCronJob(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = k8sCronJobTriggerSchema.parse(req.body);
    const result = await executeKubernetesAction(
      'K8S_TRIGGER_CRONJOB',
      parsed,
      { id: req.user!.id },
      25_000
    );

    res.status(201).json({
      success: true,
      message: `CronJob "${parsed.name}" triggered manual job "${result.jobName}" successfully.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
