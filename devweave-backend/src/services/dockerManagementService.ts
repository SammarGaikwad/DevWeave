import crypto from 'node:crypto';
import { AppError } from '../middleware/errorHandler.js';
import {
  isResourceProtected,
  assertResourceNotProtected,
  assertNetworkDisconnectNotProtected,
  assertImagePruneNotProtected,
  recordAuditEvent,
} from './dockerProtectionService.js';
import { getRunnerSnapshot } from './dockerRunnerService.js';

export interface DockerContainerSummary {
  id: string;
  name: string;
  image: string;
  imageId?: string;
  status: string;
  state: 'running' | 'exited' | 'paused' | 'restarting' | 'dead' | 'created';
  created: string;
  ports: Array<{ hostPort?: number; containerPort: number; protocol: string }>;
  isProtected: boolean;
  cpuPercent?: string;
  memoryUsage?: string;
}

export interface DockerImageSummary {
  id: string;
  repository: string;
  tag: string;
  size: string;
  created: string;
  inUseByContainers: string[];
  isProtected: boolean;
  isDangling: boolean;
}

export interface DockerNetworkSummary {
  id: string;
  name: string;
  driver: string;
  scope: string;
  containers: string[];
  isProtected: boolean;
}

export interface DockerVolumeSummary {
  name: string;
  driver: string;
  mountpoint?: string;
  inUseByContainers: string[];
  isProtected: boolean;
}

export interface DockerInventorySnapshot {
  containers: DockerContainerSummary[];
  images: DockerImageSummary[];
  networks: DockerNetworkSummary[];
  volumes: DockerVolumeSummary[];
  updatedAt: string;
}

export type DockerManagementActionType =
  | 'CONTAINER_START'
  | 'CONTAINER_STOP'
  | 'CONTAINER_RESTART'
  | 'CONTAINER_DELETE'
  | 'CONTAINER_CREATE'
  | 'CONTAINER_RECREATE'
  | 'CONTAINER_LOGS'
  | 'CONTAINER_INSPECT'
  | 'IMAGE_TAG'
  | 'IMAGE_DELETE'
  | 'IMAGE_PRUNE_DANGLING'
  | 'NETWORK_CREATE'
  | 'NETWORK_DELETE'
  | 'NETWORK_CONNECT'
  | 'NETWORK_DISCONNECT'
  | 'VOLUME_CREATE'
  | 'VOLUME_DELETE';

export interface DockerManagementJob {
  id: string;
  jobType: 'MANAGEMENT';
  actionType: DockerManagementActionType;
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
let liveInventory: DockerInventorySnapshot = {
  containers: [],
  images: [],
  networks: [],
  volumes: [],
  updatedAt: new Date(0).toISOString(),
};

// Queue of pending management jobs
const pendingManagementJobs = new Map<string, DockerManagementJob>();
const jobWaiters = new Map<
  string,
  { resolve: (value: any) => void; reject: (reason?: any) => void; timer: NodeJS.Timeout }
>();

// Sensitive keys to mask in inspect outputs
const SENSITIVE_KEY_REGEX = /(pass|secret|token|key|cred|auth|jwt|hash)/i;

export function maskSecretsInObject<T = any>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => maskSecretsInObject(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const clone: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof key === 'string' && SENSITIVE_KEY_REGEX.test(key) && typeof value === 'string') {
        clone[key] = '********';
      } else if (key === 'Env' && Array.isArray(value)) {
        // Redact Docker container Env array e.g. ["FOO=secret"]
        clone[key] = value.map((envStr) => {
          if (typeof envStr === 'string' && envStr.includes('=')) {
            const [k] = envStr.split('=');
            if (SENSITIVE_KEY_REGEX.test(k)) {
              return `${k}=********`;
            }
          }
          return envStr;
        });
      } else {
        clone[key] = maskSecretsInObject(value);
      }
    }
    return clone as T;
  }

  return obj;
}

/**
 * Updates the live inventory from the runner's telemetry snapshot.
 */
export function updateInventorySnapshot(snapshot: Partial<DockerInventorySnapshot>): void {
  const now = new Date().toISOString();

  const tempInventory: DockerInventorySnapshot = {
    containers: snapshot.containers || [],
    images: snapshot.images || [],
    networks: snapshot.networks || [],
    volumes: snapshot.volumes || [],
    updatedAt: now,
  };

  const containers = (snapshot.containers || []).map((c) => ({
    ...c,
    isProtected: isResourceProtected('container', c.name, tempInventory) || isResourceProtected('container', c.id, tempInventory),
  }));

  const images = (snapshot.images || []).map((img) => ({
    ...img,
    isProtected: isResourceProtected('image', img.id, tempInventory) || isResourceProtected('image', img.repository || img.tag, tempInventory),
  }));

  const networks = (snapshot.networks || []).map((net) => ({
    ...net,
    isProtected: isResourceProtected('network', net.name, tempInventory) || isResourceProtected('network', net.id, tempInventory),
  }));

  const volumes = (snapshot.volumes || []).map((vol) => ({
    ...vol,
    isProtected: isResourceProtected('volume', vol.name, tempInventory),
  }));

  liveInventory = {
    containers,
    images,
    networks,
    volumes,
    updatedAt: now,
  };
}

export function getInventorySnapshot(): DockerInventorySnapshot & { runnerOnline: boolean } {
  const runnerState = getRunnerSnapshot();
  return {
    ...liveInventory,
    runnerOnline: runnerState.online,
  };
}

/**
 * Claims the next pending management job for the runner.
 */
export function leaseNextManagementJob(): DockerManagementJob | null {
  for (const job of pendingManagementJobs.values()) {
    if (job.status === 'QUEUED') {
      job.status = 'EXECUTING';
      return job;
    }
  }
  return null;
}

/**
 * Called by runner when it finishes a management job.
 */
export function completeManagementJob(
  jobId: string,
  result: { success: boolean; data?: any; error?: string }
): void {
  const job = pendingManagementJobs.get(jobId);
  if (!job) return;

  job.completedAt = new Date().toISOString();
  job.status = result.success ? 'SUCCEEDED' : 'FAILED';
  job.result = result.data ? maskSecretsInObject(result.data) : undefined;
  job.error = result.error;

  recordAuditEvent({
    userId: job.userId,
    userEmail: job.userEmail,
    action: job.actionType,
    resourceType: getResourceTypeFromAction(job.actionType),
    resourceName: getResourceNameFromParams(job.params),
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
      waiter.reject(new AppError(result.error || `Docker command ${job.actionType} failed.`, 400));
    }
  }

  // Remove completed job after 1 minute
  setTimeout(() => {
    pendingManagementJobs.delete(jobId);
  }, 60_000);
}

/**
 * Enqueues a management action and waits for the runner to execute it.
 */
export async function executeManagementAction<T = any>(
  actionType: DockerManagementActionType,
  params: Record<string, any>,
  user: { id: string; email?: string },
  timeoutMs = 15_000
): Promise<T> {
  const runnerState = getRunnerSnapshot();
  if (!runnerState.online) {
    throw new AppError(
      'Windows Docker Desktop runner is offline. Please start the runner using ".\\scripts\\run-docker-runner.ps1" to execute Docker commands.',
      503
    );
  }

  // Validate resource protection rules
  validateActionProtection(actionType, params, liveInventory);

  const id = `mgnt_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const job: DockerManagementJob = {
    id,
    jobType: 'MANAGEMENT',
    actionType,
    params,
    userId: user.id,
    userEmail: user.email,
    status: 'QUEUED',
    createdAt: new Date().toISOString(),
  };

  pendingManagementJobs.set(id, job);

  // Return promise that resolves when runner reports completion
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      jobWaiters.delete(id);
      job.status = 'FAILED';
      job.error = 'Operation timed out waiting for Windows Docker runner response.';
      reject(new AppError('Operation timed out waiting for Windows Docker Desktop runner response.', 504));
    }, timeoutMs);

    jobWaiters.set(id, { resolve, reject, timer });
  });
}

function validateActionProtection(
  actionType: DockerManagementActionType,
  params: Record<string, any>,
  inventory?: DockerInventorySnapshot
): void {
  const isInventoryAvailable = inventory && inventory.updatedAt !== new Date(0).toISOString();

  switch (actionType) {
    case 'CONTAINER_STOP':
    case 'CONTAINER_DELETE':
    case 'CONTAINER_RESTART': {
      const nameOrId = params.containerId || params.name || '';
      if (!isInventoryAvailable) {
        assertResourceNotProtected('container', nameOrId, actionType);
        throw new AppError(
          `Cannot verify container identity for operation "${actionType}": live Docker inventory is unavailable.`,
          503
        );
      }
      assertResourceNotProtected('container', nameOrId, actionType, inventory);
      break;
    }

    case 'CONTAINER_RECREATE': {
      const containerId = params.containerId || params.name || '';
      if (!isInventoryAvailable) {
        assertResourceNotProtected('container', containerId, actionType);
        throw new AppError(
          `Cannot verify container identity for operation "${actionType}": live Docker inventory is unavailable.`,
          503
        );
      }
      assertResourceNotProtected('container', containerId, actionType, inventory);

      const newName = params.name || params.newConfig?.name;
      if (newName) {
        assertResourceNotProtected('container', newName, actionType, inventory);
      }
      break;
    }

    case 'CONTAINER_CREATE': {
      const name = params.name;
      if (name) {
        assertResourceNotProtected('container', name, actionType, inventory);
      }
      break;
    }

    case 'IMAGE_DELETE': {
      const nameOrId = params.imageIdOrTag || '';
      if (!isInventoryAvailable) {
        assertResourceNotProtected('image', nameOrId, actionType);
        throw new AppError(
          `Cannot verify image identity for operation "${actionType}": live Docker inventory is unavailable.`,
          503
        );
      }
      assertResourceNotProtected('image', nameOrId, actionType, inventory);
      break;
    }

    case 'IMAGE_PRUNE_DANGLING': {
      if (!isInventoryAvailable) {
        throw new AppError(
          `Cannot verify dangling images for operation "${actionType}": live Docker inventory is unavailable.`,
          503
        );
      }
      assertImagePruneNotProtected(actionType, inventory);
      break;
    }

    case 'NETWORK_DELETE': {
      const nameOrId = params.networkIdOrName || params.networkName || '';
      if (!isInventoryAvailable) {
        assertResourceNotProtected('network', nameOrId, actionType);
        throw new AppError(
          `Cannot verify network identity for operation "${actionType}": live Docker inventory is unavailable.`,
          503
        );
      }
      assertResourceNotProtected('network', nameOrId, actionType, inventory);
      break;
    }

    case 'NETWORK_DISCONNECT': {
      const networkName = params.networkIdOrName || params.networkName || '';
      const containerId = params.containerId || '';
      if (!isInventoryAvailable) {
        assertResourceNotProtected('network', networkName, actionType);
        assertResourceNotProtected('container', containerId, actionType);
        throw new AppError(
          `Cannot verify network disconnect targets for operation "${actionType}": live Docker inventory is unavailable.`,
          503
        );
      }
      assertNetworkDisconnectNotProtected(networkName, containerId, actionType, inventory);
      break;
    }

    case 'VOLUME_DELETE': {
      const nameOrId = params.volumeName || '';
      if (!isInventoryAvailable) {
        assertResourceNotProtected('volume', nameOrId, actionType);
        throw new AppError(
          `Cannot verify volume identity for operation "${actionType}": live Docker inventory is unavailable.`,
          503
        );
      }
      assertResourceNotProtected('volume', nameOrId, actionType, inventory);
      break;
    }
  }
}

function getResourceTypeFromAction(action: DockerManagementActionType): 'container' | 'image' | 'network' | 'volume' | 'system' {
  if (action.startsWith('CONTAINER_')) return 'container';
  if (action.startsWith('IMAGE_')) return 'image';
  if (action.startsWith('NETWORK_')) return 'network';
  if (action.startsWith('VOLUME_')) return 'volume';
  return 'system';
}

function getResourceNameFromParams(params: Record<string, any>): string {
  return (
    params.containerId ||
    params.name ||
    params.imageIdOrTag ||
    params.sourceImage ||
    params.networkIdOrName ||
    params.networkName ||
    params.volumeName ||
    'unknown'
  );
}
