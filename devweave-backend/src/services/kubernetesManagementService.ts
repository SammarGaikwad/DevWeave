import crypto from 'node:crypto';
import { AppError } from '../middleware/errorHandler.js';
import {
  assertResourceNotProtected,
  assertNamespaceNotProtected,
  recordKubernetesAuditEvent,
} from './kubernetesProtectionService.js';
import { getKubernetesRunnerSnapshot } from './kubernetesRunnerService.js';

export interface K8sDeploymentSummary {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  availableReplicas: number;
  updatedReplicas: number;
  age: string;
  images: string[];
  selector: Record<string, string>;
  conditions?: Array<{ type: string; status: string; reason?: string; message?: string }>;
}

export interface K8sPodSummary {
  name: string;
  namespace: string;
  phase: string;
  status: string;
  readyContainers: number;
  totalContainers: number;
  restarts: number;
  age: string;
  ip?: string;
  node?: string;
  images: string[];
  containers: Array<{ name: string; image: string; ready: boolean; restartCount: number }>;
}

export interface K8sStatefulSetSummary {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  age: string;
  images: string[];
}

export interface K8sDaemonSetSummary {
  name: string;
  namespace: string;
  desired: number;
  current: number;
  ready: number;
  age: string;
  images: string[];
}

export interface K8sReplicaSetSummary {
  name: string;
  namespace: string;
  desired: number;
  current: number;
  ready: number;
  age: string;
}

export interface K8sJobSummary {
  name: string;
  namespace: string;
  completions: string;
  duration?: string;
  age: string;
  active: number;
  succeeded: number;
  failed: number;
}

export interface K8sCronJobSummary {
  name: string;
  namespace: string;
  schedule: string;
  suspend: boolean;
  active: number;
  lastSchedule?: string;
  age: string;
}

export interface K8sServiceSummary {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIP?: string;
  ports: Array<{ name?: string; port: number; targetPort?: number | string; protocol: string; nodePort?: number }>;
  age: string;
  selector?: Record<string, string>;
  isProtected?: boolean;
}

export interface K8sIngressSummary {
  name: string;
  namespace: string;
  hosts: string[];
  address?: string;
  ports?: string;
  age: string;
}

export interface K8sNetworkPolicySummary {
  name: string;
  namespace: string;
  podSelector: string;
  policyTypes: string[];
  age: string;
}

export interface K8sConfigMapSummary {
  name: string;
  namespace: string;
  dataCount: number;
  keys: string[];
  age: string;
}

export interface K8sSecretSummary {
  name: string;
  namespace: string;
  type: string;
  dataCount: number;
  keys: string[];
  age: string;
}

export interface K8sServiceAccountSummary {
  name: string;
  namespace: string;
  secretsCount: number;
  age: string;
}

export interface K8sPvcSummary {
  name: string;
  namespace: string;
  status: string;
  volume?: string;
  capacity?: string;
  accessModes: string[];
  storageClass?: string;
  age: string;
}

export interface K8sPvSummary {
  name: string;
  capacity: string;
  accessModes: string[];
  reclaimPolicy: string;
  status: string;
  claim?: string;
  storageClass?: string;
  age: string;
}

export interface K8sStorageClassSummary {
  name: string;
  provisioner: string;
  reclaimPolicy?: string;
  volumeBindingMode?: string;
  age: string;
}

export interface K8sNodeSummary {
  name: string;
  status: string;
  roles: string[];
  age: string;
  version: string;
  internalIP?: string;
  cpuCapacity?: string;
  memoryCapacity?: string;
  conditions?: Array<{ type: string; status: string; reason?: string }>;
}

export interface K8sNamespaceSummary {
  name: string;
  status: string;
  age: string;
  isProtected?: boolean;
}

export interface K8sEventSummary {
  type: string;
  reason: string;
  object: string;
  message: string;
  count: number;
  lastTimestamp: string;
  namespace: string;
}

export interface KubernetesInventorySnapshot {
  clusterConnected: boolean;
  context: string | null;
  serverVersion: string | null;
  clientVersion: string | null;
  endpoint: string | null;
  namespaces: K8sNamespaceSummary[];
  nodes: K8sNodeSummary[];
  deployments: K8sDeploymentSummary[];
  pods: K8sPodSummary[];
  statefulSets: K8sStatefulSetSummary[];
  daemonSets: K8sDaemonSetSummary[];
  replicaSets: K8sReplicaSetSummary[];
  jobs: K8sJobSummary[];
  cronJobs: K8sCronJobSummary[];
  services: K8sServiceSummary[];
  ingresses: K8sIngressSummary[];
  networkPolicies: K8sNetworkPolicySummary[];
  configMaps: K8sConfigMapSummary[];
  secrets: K8sSecretSummary[];
  serviceAccounts: K8sServiceAccountSummary[];
  persistentVolumeClaims: K8sPvcSummary[];
  persistentVolumes: K8sPvSummary[];
  storageClasses: K8sStorageClassSummary[];
  events: K8sEventSummary[];
  updatedAt: string;
}

export type KubernetesActionType =
  | 'K8S_APPLY_MANIFEST'
  | 'K8S_DELETE_RESOURCE'
  | 'K8S_SCALE_RESOURCE'
  | 'K8S_RESTART_RESOURCE'
  | 'K8S_ROLLOUT_UNDO'
  | 'K8S_GET_LOGS'
  | 'K8S_GET_DESCRIBE'
  | 'K8S_GET_RESOURCE_YAML'
  | 'K8S_CREATE_NAMESPACE'
  | 'K8S_DELETE_NAMESPACE'
  | 'K8S_REVEAL_SECRET'
  | 'K8S_PATCH_CRONJOB_SUSPEND'
  | 'K8S_TRIGGER_CRONJOB';

export interface KubernetesManagementJob {
  id: string;
  jobType: 'K8S_MANAGEMENT';
  actionType: KubernetesActionType;
  params: Record<string, any>;
  userId: string;
  userEmail?: string;
  status: 'QUEUED' | 'EXECUTING' | 'SUCCEEDED' | 'FAILED';
  result?: any;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

// In-memory inventory cache
let liveInventory: KubernetesInventorySnapshot = {
  clusterConnected: false,
  context: null,
  serverVersion: null,
  clientVersion: null,
  endpoint: null,
  namespaces: [],
  nodes: [],
  deployments: [],
  pods: [],
  statefulSets: [],
  daemonSets: [],
  replicaSets: [],
  jobs: [],
  cronJobs: [],
  services: [],
  ingresses: [],
  networkPolicies: [],
  configMaps: [],
  secrets: [],
  serviceAccounts: [],
  persistentVolumeClaims: [],
  persistentVolumes: [],
  storageClasses: [],
  events: [],
  updatedAt: new Date(0).toISOString(),
};

// Queue of pending jobs
const pendingJobs = new Map<string, KubernetesManagementJob>();

// Promise waiters map for synchronous API calls
const jobWaiters = new Map<
  string,
  {
    resolve: (val: any) => void;
    reject: (err: any) => void;
    timer: NodeJS.Timeout;
  }
>();

export function updateKubernetesInventory(snapshot: Partial<KubernetesInventorySnapshot>): void {
  const now = new Date().toISOString();
  liveInventory = {
    clusterConnected: snapshot.clusterConnected ?? false,
    context: snapshot.context ?? null,
    serverVersion: snapshot.serverVersion ?? null,
    clientVersion: snapshot.clientVersion ?? null,
    endpoint: snapshot.endpoint ?? null,
    namespaces: snapshot.namespaces || [],
    nodes: snapshot.nodes || [],
    deployments: snapshot.deployments || [],
    pods: snapshot.pods || [],
    statefulSets: snapshot.statefulSets || [],
    daemonSets: snapshot.daemonSets || [],
    replicaSets: snapshot.replicaSets || [],
    jobs: snapshot.jobs || [],
    cronJobs: snapshot.cronJobs || [],
    services: snapshot.services || [],
    ingresses: snapshot.ingresses || [],
    networkPolicies: snapshot.networkPolicies || [],
    configMaps: snapshot.configMaps || [],
    secrets: snapshot.secrets || [],
    serviceAccounts: snapshot.serviceAccounts || [],
    persistentVolumeClaims: snapshot.persistentVolumeClaims || [],
    persistentVolumes: snapshot.persistentVolumes || [],
    storageClasses: snapshot.storageClasses || [],
    events: snapshot.events || [],
    updatedAt: now,
  };
}

export function getKubernetesInventory(): KubernetesInventorySnapshot & { runnerOnline: boolean } {
  const runnerState = getKubernetesRunnerSnapshot();
  return {
    ...liveInventory,
    runnerOnline: runnerState.online,
  };
}

export function leaseNextKubernetesJob(): KubernetesManagementJob | null {
  for (const job of pendingJobs.values()) {
    if (job.status === 'QUEUED') {
      job.status = 'EXECUTING';
      return job;
    }
  }
  return null;
}

export function completeKubernetesJob(
  jobId: string,
  result: { success: boolean; data?: any; error?: string },
): void {
  const job = pendingJobs.get(jobId);
  if (!job) return;

  job.completedAt = new Date().toISOString();
  job.status = result.success ? 'SUCCEEDED' : 'FAILED';
  job.result = result.data;
  job.error = result.error;

  recordKubernetesAuditEvent({
    userId: job.userId,
    userEmail: job.userEmail,
    action: job.actionType,
    resourceKind: job.params.kind || (job.actionType.includes('NAMESPACE') ? 'Namespace' : 'Manifest'),
    resourceName: job.params.name || (job.params.yaml ? 'custom-manifest' : 'unknown'),
    namespace: job.params.namespace,
    status: result.success ? 'SUCCESS' : 'FAILED',
    details: job.params,
    error: result.error,
  });

  const waiter = jobWaiters.get(jobId);
  if (waiter) {
    clearTimeout(waiter.timer);
    jobWaiters.delete(jobId);
    if (result.success) {
      waiter.resolve(job.result);
    } else {
      waiter.reject(new AppError(result.error || `Kubernetes action ${job.actionType} failed.`, 400));
    }
  }

  // Prune completed job after 60s
  setTimeout(() => {
    pendingJobs.delete(jobId);
  }, 60_000);
}

export async function executeKubernetesAction(
  actionType: KubernetesActionType,
  params: Record<string, any>,
  user: { id: string; email?: string },
  timeoutMs: number = 30_000,
): Promise<any> {
  const runnerState = getKubernetesRunnerSnapshot();
  if (!runnerState.online) {
    throw new AppError(
      'DevWeave Kubernetes runner is currently offline. Please start the local Kubernetes runner using `npm run runner:k8s` or `.\\scripts\\run-k8s-runner.ps1`.',
      503,
    );
  }

  // Protection checks
  if (actionType === 'K8S_DELETE_RESOURCE') {
    assertResourceNotProtected(params.kind, params.name, params.namespace);
  } else if (actionType === 'K8S_DELETE_NAMESPACE') {
    assertNamespaceNotProtected(params.name);
  }

  const jobId = `k8s_job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const job: KubernetesManagementJob = {
    id: jobId,
    jobType: 'K8S_MANAGEMENT',
    actionType,
    params,
    userId: user.id,
    userEmail: user.email,
    status: 'QUEUED',
    createdAt: new Date().toISOString(),
  };

  pendingJobs.set(jobId, job);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      jobWaiters.delete(jobId);
      job.status = 'FAILED';
      job.error = `Kubernetes operation timed out after ${Math.round(timeoutMs / 1000)}s waiting for runner execution.`;
      reject(new AppError(job.error, 504));
    }, timeoutMs);

    jobWaiters.set(jobId, { resolve, reject, timer });
  });
}
