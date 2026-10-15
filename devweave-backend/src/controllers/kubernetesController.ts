import { Request, Response, NextFunction } from 'express';
import {
  checkClusterStatus,
  K8S_TEMPLATES,
  generateCustomManifest,
  validateK8sYaml,
  K8sCustomOptions,
} from '../services/kubernetesService.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';

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
