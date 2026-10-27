import { exec } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  type ValidatedKubernetesRunnerSnapshot,
} from '../schemas/kubernetesSchema.js';
import {
  collectKubernetesInventory,
  executeKubernetesJob,
} from './kubernetesManagementExecutor.js';
import type { KubernetesInventorySnapshot } from '../services/kubernetesManagementService.js';

dotenv.config();

const execAsync = promisify(exec);

export interface KubernetesRunnerConfig {
  runnerId: string;
  backendUrl: string;
  runnerToken: string;
  intervalMs: number;
  timeoutMs: number;
}

export interface K8sTelemetryResult {
  snapshot: ValidatedKubernetesRunnerSnapshot;
  clusterAvailable: boolean;
}

export function loadKubernetesRunnerConfig(): KubernetesRunnerConfig {
  const runnerToken = (
    process.env.KUBERNETES_RUNNER_TOKEN ||
    process.env.DOCKER_RUNNER_TOKEN ||
    ''
  ).trim();

  if (!runnerToken) {
    throw new Error(
      'KUBERNETES_RUNNER_TOKEN (or DOCKER_RUNNER_TOKEN) environment variable is required.',
    );
  }

  const rawRunnerId = (
    process.env.KUBERNETES_RUNNER_ID ||
    process.env.DOCKER_RUNNER_ID ||
    'windows-k8s-runner'
  ).trim();

  const backendUrl = (
    process.env.DEVWEAVE_BACKEND_URL ||
    process.env.BACKEND_URL ||
    'https://devweave.onrender.com'
  ).replace(/\/$/, '');

  const intervalMs = Math.max(
    5000,
    parseInt(process.env.KUBERNETES_RUNNER_INTERVAL_MS || '10000', 10) || 10000,
  );
  const timeoutMs = Math.max(
    2000,
    parseInt(process.env.KUBERNETES_RUNNER_TIMEOUT_MS || '8000', 10) || 8000,
  );

  return {
    runnerId: rawRunnerId,
    backendUrl,
    runnerToken,
    intervalMs,
    timeoutMs,
  };
}

export async function collectKubernetesTelemetry(
  runnerId: string,
  execCommand: (cmd: string, opts?: { timeout?: number }) => Promise<{ stdout: string }> = (
    cmd,
    opts,
  ) => execAsync(cmd, { timeout: opts?.timeout ?? 3000 }),
): Promise<K8sTelemetryResult> {
  let kubectlVersion: string | null = null;
  let currentContext: string | null = null;
  let clusterEndpoint: string | null = null;
  let serverVersion: string | null = null;
  let clusterConnected = false;
  let nodesCount = 0;
  let namespacesCount = 0;
  let podsCount = 0;
  let errorMessage: string | null = null;

  // 1. Check kubectl version
  try {
    const { stdout } = await execCommand('kubectl version --client --output=json', { timeout: 3000 });
    const parsed = JSON.parse(stdout);
    kubectlVersion = parsed.clientVersion?.gitVersion || 'Installed';
  } catch {
    kubectlVersion = null;
    errorMessage = 'kubectl CLI binary not found in PATH.';
  }

  // 2. Check current context
  if (kubectlVersion) {
    try {
      const { stdout } = await execCommand('kubectl config current-context', { timeout: 2000 });
      currentContext = stdout.trim() || null;
      if (!currentContext) {
        errorMessage = 'kubectl current-context is not configured.';
      }
    } catch (ctxErr: any) {
      currentContext = null;
      errorMessage = ctxErr?.message || 'Error reading kubectl current-context.';
    }
  }

  // 3. Check cluster connectivity via cluster-info
  if (currentContext) {
    try {
      const { stdout } = await execCommand('kubectl cluster-info --request-timeout=3s', { timeout: 4000 });
      const match = stdout.match(/https?:\/\/[^\s]+/);
      clusterEndpoint = match ? match[0] : null;
      clusterConnected = true;
      serverVersion = 'Connected';
      errorMessage = null;
    } catch (clusterErr: any) {
      clusterConnected = false;
      errorMessage = clusterErr?.message || 'Cluster API endpoint actively refused connection or timed out.';
    }
  }

  // 4. Quick count if cluster is connected
  if (clusterConnected) {
    try {
      const { stdout: nodesOut } = await execCommand('kubectl get nodes --no-headers', { timeout: 3000 });
      nodesCount = nodesOut.trim() ? nodesOut.trim().split('\n').length : 0;
    } catch {
      nodesCount = 0;
    }

    try {
      const { stdout: nsOut } = await execCommand('kubectl get namespaces --no-headers', { timeout: 3000 });
      namespacesCount = nsOut.trim() ? nsOut.trim().split('\n').length : 0;
    } catch {
      namespacesCount = 0;
    }

    try {
      const { stdout: podsOut } = await execCommand('kubectl get pods -A --no-headers', { timeout: 3000 });
      podsCount = podsOut.trim() ? podsOut.trim().split('\n').length : 0;
    } catch {
      podsCount = 0;
    }
  }

  return {
    clusterAvailable: clusterConnected,
    snapshot: {
      runnerId,
      hostname: os.hostname(),
      kubectlVersion,
      clusterConnected,
      currentContext,
      clusterEndpoint,
      serverVersion,
      nodesCount,
      namespacesCount,
      podsCount,
      reportedAt: new Date().toISOString(),
      error: errorMessage,
    },
  };
}

export async function sendKubernetesHeartbeat(
  snapshot: ValidatedKubernetesRunnerSnapshot,
  config: KubernetesRunnerConfig,
  fetchFn: typeof fetch = fetch,
): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    const res = await fetchFn(`${config.backendUrl}/api/v1/kubernetes/runner/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.runnerToken}`,
      },
      body: JSON.stringify(snapshot),
    });

    if (res.ok || res.status === 202) {
      return { success: true, status: res.status };
    }

    const bodyText = await res.text().catch(() => '');
    return { success: false, status: res.status, error: bodyText || `HTTP ${res.status}` };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function pushKubernetesInventorySnapshot(
  config: KubernetesRunnerConfig,
  inventory: KubernetesInventorySnapshot,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  try {
    await fetchFn(`${config.backendUrl}/api/v1/kubernetes/runner/inventory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.runnerToken}`,
      },
      body: JSON.stringify(inventory),
    });
  } catch {
    // Inventory push error
  }
}

export async function pollKubernetesJob(
  config: KubernetesRunnerConfig,
  fetchFn: typeof fetch = fetch,
): Promise<any | null> {
  try {
    const res = await fetchFn(`${config.backendUrl}/api/v1/kubernetes/runner/jobs/poll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.runnerToken}`,
      },
      body: JSON.stringify({ runnerId: config.runnerId }),
    });

    if (res.status === 200) {
      const data = (await res.json()) as any;
      return data?.data || null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function completeRunnerJob(
  jobId: string,
  result: { success: boolean; data?: any; error?: string },
  config: KubernetesRunnerConfig,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  try {
    await fetchFn(`${config.backendUrl}/api/v1/kubernetes/runner/jobs/${jobId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.runnerToken}`,
      },
      body: JSON.stringify(result),
    });
  } catch {
    // Completion reporting error
  }
}

export function startKubernetesRunner(
  config: KubernetesRunnerConfig,
  deps?: {
    collectFn?: typeof collectKubernetesTelemetry;
    sendFn?: typeof sendKubernetesHeartbeat;
    collectInvFn?: typeof collectKubernetesInventory;
    pushInvFn?: typeof pushKubernetesInventorySnapshot;
    pollJobFn?: typeof pollKubernetesJob;
    completeJobFn?: typeof completeRunnerJob;
    execJobFn?: typeof executeKubernetesJob;
    logger?: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };
  },
): { stop: () => void } {
  const logger = deps?.logger || {
    info: (msg: string) => console.log(`[INFO] [${new Date().toISOString()}] ${msg}`),
    warn: (msg: string) => console.warn(`[WARN] [${new Date().toISOString()}] ${msg}`),
    error: (msg: string) => console.error(`[ERROR] [${new Date().toISOString()}] ${msg}`),
  };

  const collect = deps?.collectFn || collectKubernetesTelemetry;
  const send = deps?.sendFn || sendKubernetesHeartbeat;
  const collectInv = deps?.collectInvFn || collectKubernetesInventory;
  const pushInv = deps?.pushInvFn || pushKubernetesInventorySnapshot;
  const pollJob = deps?.pollJobFn || pollKubernetesJob;
  const completeJob = deps?.completeJobFn || completeRunnerJob;
  const execJob = deps?.execJobFn || executeKubernetesJob;

  logger.info(
    `Starting DevWeave Windows Kubernetes Runner (${config.runnerId}) -> target: ${config.backendUrl} (interval: ${config.intervalMs / 1000}s)`,
  );

  let isRunning = false;
  let isStopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let iterationCounter = 0;

  const runIteration = async () => {
    if (isStopped || isRunning) return;
    isRunning = true;

    try {
      const { snapshot, clusterAvailable } = await collect(config.runnerId);
      if (isStopped) return;

      const res = await send(snapshot, config);
      if (isStopped) return;

      if (res.success) {
        logger.info(
          `Heartbeat accepted [Cluster: ${clusterAvailable ? 'CONNECTED' : 'DISCONNECTED'}, Context: ${snapshot.currentContext || 'none'}, Nodes: ${snapshot.nodesCount}, Pods: ${snapshot.podsCount}]`,
        );
      } else {
        logger.warn(
          `Heartbeat dispatch failed: ${res.error || `HTTP ${res.status}`}. Retrying in ${config.intervalMs / 1000}s...`,
        );
      }

      if (clusterAvailable) {
        // Collect inventory every 3 iterations or first iteration
        if (iterationCounter % 3 === 0) {
          try {
            const inv = await collectInv();
            await pushInv(config, inv);
          } catch (invErr) {
            logger.warn(`Inventory collection warning: ${invErr}`);
          }
        }

        // Poll for management job
        try {
          const job = await pollJob(config);
          if (job && !isStopped) {
            logger.info(`Leased Kubernetes management job: ${job.actionType} (${job.id})`);
            const jobResult = await execJob(job);
            await completeJob(job.id, jobResult, config);
            logger.info(`Completed Kubernetes job ${job.id} (success: ${jobResult.success})`);

            // Immediately push refreshed inventory
            const refreshedInv = await collectInv();
            await pushInv(config, refreshedInv);
          }
        } catch (jobErr) {
          logger.warn(`Job polling or execution warning: ${jobErr}`);
        }

        iterationCounter++;
      }
    } catch (error) {
      if (isStopped) return;
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Kubernetes telemetry or dispatch error: ${msg}`);
    } finally {
      isRunning = false;
    }
  };

  void runIteration();

  timer = setInterval(() => {
    void runIteration();
  }, config.intervalMs);

  return {
    stop: () => {
      if (isStopped) return;
      isStopped = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      logger.info('Kubernetes Runner stopped gracefully.');
    },
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  try {
    const config = loadKubernetesRunnerConfig();
    const runner = startKubernetesRunner(config);

    const shutdown = () => {
      runner.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error(
      `[FATAL] Failed to start Kubernetes runner: ${error instanceof Error ? error.message : error}`,
    );
    process.exit(1);
  }
}
