import { z } from 'zod';

const DNS_1123_NAME_REGEX = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;

export const kubernetesRunnerSnapshotSchema = z.object({
  runnerId: z.string().min(1).max(100),
  hostname: z.string().min(1),
  kubectlVersion: z.string().nullable().optional(),
  clusterConnected: z.boolean(),
  currentContext: z.string().nullable().optional(),
  clusterEndpoint: z.string().nullable().optional(),
  serverVersion: z.string().nullable().optional(),
  nodesCount: z.number().int().nonnegative().optional().default(0),
  namespacesCount: z.number().int().nonnegative().optional().default(0),
  podsCount: z.number().int().nonnegative().optional().default(0),
  reportedAt: z.string().datetime({ offset: true }),
  error: z.string().nullable().optional(),
});

export type ValidatedKubernetesRunnerSnapshot = z.infer<
  typeof kubernetesRunnerSnapshotSchema
>;

export const k8sApplyManifestSchema = z.object({
  yaml: z.string().min(1, 'YAML manifest is required.'),
  namespace: z.string().regex(DNS_1123_NAME_REGEX, {
    message: 'Invalid namespace format.',
  }).optional(),
});

export const k8sDeleteResourceSchema = z.object({
  kind: z.string().min(1, 'Resource kind is required.'),
  name: z.string().min(1, 'Resource name is required.'),
  namespace: z.string().optional(),
});

export const k8sScaleResourceSchema = z.object({
  kind: z.enum(['deployment', 'statefulset', 'Deployment', 'StatefulSet']).default('deployment'),
  name: z.string().min(1, 'Resource name is required.'),
  namespace: z.string().default('default'),
  replicas: z.number().int().min(0).max(100),
});

export const k8sRestartResourceSchema = z.object({
  kind: z.enum(['deployment', 'statefulset', 'daemonset', 'Deployment', 'StatefulSet', 'DaemonSet']).default('deployment'),
  name: z.string().min(1, 'Resource name is required.'),
  namespace: z.string().default('default'),
});

export const k8sGetLogsSchema = z.object({
  podName: z.string().min(1, 'Pod name is required.'),
  namespace: z.string().default('default'),
  container: z.string().optional(),
  tailLines: z.number().int().min(1).max(5000).default(100),
  timestamps: z.boolean().default(false),
});

export const k8sCreateNamespaceSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, {
      message: 'Namespace must consist of lower case alphanumeric characters or "-", and must start and end with an alphanumeric character.',
    }),
});

export const k8sRevealSecretSchema = z.object({
  namespace: z.string().min(1),
  name: z.string().min(1),
  key: z.string().min(1),
});
