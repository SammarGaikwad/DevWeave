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
  yaml: z
    .string()
    .min(1, 'YAML manifest is required.')
    .max(1_000_000, 'Manifest exceeds maximum allowable size of 1MB.'),
  namespace: z.string().regex(DNS_1123_NAME_REGEX, {
    message: 'Invalid namespace format.',
  }).optional(),
});

export const k8sDeleteResourceSchema = z.object({
  kind: z.string().min(1, 'Resource kind is required.').max(63),
  name: z.string().min(1, 'Resource name is required.').max(253),
  namespace: z.string().max(63).optional(),
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

export const k8sCreateServiceSchema = z.object({
  name: z
    .string()
    .min(1, 'Service name is required.')
    .max(63, 'Service name cannot exceed 63 characters.')
    .regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, {
      message: 'Service name must consist of lower case alphanumeric characters or "-", and must start and end with an alphanumeric character.',
    }),
  namespace: z
    .string()
    .min(1, 'Namespace is required.')
    .max(63)
    .regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, {
      message: 'Namespace must consist of lower case alphanumeric characters or "-".',
    })
    .default('default'),
  type: z.enum(['ClusterIP', 'NodePort', 'LoadBalancer']).default('ClusterIP'),
  selector: z.record(z.string(), z.string()).refine(
    (sel) => Object.keys(sel).length > 0 && Object.entries(sel).every(([k, v]) => k.trim() && v.trim()),
    { message: 'At least one valid selector key-value pair is required.' }
  ),
  port: z.number().int().min(1, 'Port must be between 1 and 65535.').max(65535, 'Port must be between 1 and 65535.'),
  targetPort: z.union([
    z.number().int().min(1, 'Target port must be between 1 and 65535.').max(65535, 'Target port must be between 1 and 65535.'),
    z.string().min(1).max(63),
  ]),
  protocol: z.enum(['TCP', 'UDP', 'SCTP']).default('TCP'),
  portName: z.string().max(63).optional(),
});

export type K8sCreateServiceInput = z.infer<typeof k8sCreateServiceSchema>;
