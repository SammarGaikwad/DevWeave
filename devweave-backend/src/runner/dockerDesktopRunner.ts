import { exec } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  dockerRunnerSnapshotSchema,
  type ValidatedDockerRunnerSnapshot,
} from '../schemas/dockerRunnerSchema.js';

// Load environment variables if running standalone
dotenv.config();

const execAsync = promisify(exec);

export interface RunnerConfig {
  runnerId: string;
  backendUrl: string;
  runnerToken: string;
  intervalMs: number;
  timeoutMs: number;
}

export interface TelemetryResult {
  snapshot: ValidatedDockerRunnerSnapshot;
  dockerAvailable: boolean;
}

/**
 * Loads configuration from environment variables safely.
 * Never prints or exposes the runner token.
 */
export function loadRunnerConfig(): RunnerConfig {
  const runnerToken = process.env.DOCKER_RUNNER_TOKEN?.trim() || '';
  if (!runnerToken) {
    throw new Error(
      'DOCKER_RUNNER_TOKEN environment variable is required. Please set it before running the runner.',
    );
  }

  const rawRunnerId = (process.env.DOCKER_RUNNER_ID?.trim() || 'windows-docker-runner');
  const backendUrl = (
    process.env.DEVWEAVE_BACKEND_URL ||
    process.env.BACKEND_URL ||
    'https://devweave.onrender.com'
  ).replace(/\/$/, '');

  const intervalMs = Math.max(
    5000,
    parseInt(process.env.DOCKER_RUNNER_INTERVAL_MS || '10000', 10) || 10000,
  );
  const timeoutMs = Math.max(
    2000,
    parseInt(process.env.DOCKER_RUNNER_TIMEOUT_MS || '8000', 10) || 8000,
  );

  return {
    runnerId: rawRunnerId,
    backendUrl,
    runnerToken,
    intervalMs,
    timeoutMs,
  };
}

/**
 * Collects read-only Docker telemetry without modifying containers or exposing sockets.
 * Uses only read-only `docker --version` and `docker info --format ...`.
 */
export async function collectDockerTelemetry(
  runnerId: string,
  execCommand: (cmd: string, opts?: { timeout?: number }) => Promise<{ stdout: string }> = (
    cmd,
    opts,
  ) => execAsync(cmd, { timeout: opts?.timeout ?? 3000 }),
): Promise<TelemetryResult> {
  let dockerVersion: string | null = null;
  let serverVersion: string | null = null;
  let containersRunning = 0;
  let containersTotal = 0;
  let imagesTotal = 0;
  let dockerAvailable = false;

  // 1. Read Docker CLI version
  try {
    const { stdout } = await execCommand('docker --version', { timeout: 3000 });
    dockerVersion = stdout.trim() || null;
  } catch {
    dockerVersion = null;
  }

  // 2. Read Docker Engine/Server stats
  try {
    const { stdout } = await execCommand(
      'docker info --format "{{.ServerVersion}}|{{.ContainersRunning}}|{{.Containers}}|{{.Images}}"',
      { timeout: 3500 },
    );
    const parts = stdout.trim().split('|');
    serverVersion = parts[0] || null;
    const parsedRunning = parseInt(parts[1] || '0', 10);
    const parsedTotal = parseInt(parts[2] || '0', 10);
    const parsedImages = parseInt(parts[3] || '0', 10);

    containersTotal = Math.max(0, isNaN(parsedTotal) ? 0 : parsedTotal);
    containersRunning = Math.min(
      containersTotal,
      Math.max(0, isNaN(parsedRunning) ? 0 : parsedRunning),
    );
    imagesTotal = Math.max(0, isNaN(parsedImages) ? 0 : parsedImages);
    dockerAvailable = Boolean(serverVersion);
  } catch {
    serverVersion = null;
    containersRunning = 0;
    containersTotal = 0;
    imagesTotal = 0;
    dockerAvailable = false;
  }

  // Sanitize hostname to conform to hostname schema
  const rawHostname = os.hostname() || 'windows-host';
  const sanitizedHostname = rawHostname.replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 255);

  const rawSnapshot = {
    runnerId,
    hostname: sanitizedHostname,
    dockerVersion,
    serverVersion,
    containersRunning,
    containersTotal,
    imagesTotal,
    reportedAt: new Date().toISOString(),
  };

  const parsed = dockerRunnerSnapshotSchema.parse(rawSnapshot);

  return {
    snapshot: parsed,
    dockerAvailable,
  };
}

/**
 * Sends validated telemetry snapshot to DevWeave backend over HTTPS.
 * Has request timeouts and handles network failures gracefully without throwing.
 * Never logs or reveals the runner token.
 */
export async function sendHeartbeat(
  snapshot: ValidatedDockerRunnerSnapshot,
  config: Pick<RunnerConfig, 'backendUrl' | 'runnerToken' | 'timeoutMs'>,
  fetchFn: typeof fetch = fetch,
): Promise<{ success: boolean; status?: number; error?: string }> {
  const targetUrl = `${config.backendUrl}/api/v1/docker/runner/heartbeat`;
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

    const response = await fetchFn(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.runnerToken}`,
      },
      body: JSON.stringify(snapshot),
      signal: controller.signal,
    });

    if (response.ok) {
      return { success: true, status: response.status };
    }

    const errText = await response.text().catch(() => '');
    return {
      success: false,
      status: response.status,
      error: `HTTP ${response.status}: ${errText.slice(0, 100)}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown network failure';
    return {
      success: false,
      error: message,
    };
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Starts the Docker Runner execution loop.
 * Periodically collects telemetry and sends heartbeat every 10 seconds.
 */
export function startDockerRunner(
  config: RunnerConfig,
  deps?: {
    collectFn?: typeof collectDockerTelemetry;
    sendFn?: typeof sendHeartbeat;
    logger?: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };
  },
): { stop: () => void } {
  const logger = deps?.logger || {
    info: (msg: string) => console.log(`[INFO] [${new Date().toISOString()}] ${msg}`),
    warn: (msg: string) => console.warn(`[WARN] [${new Date().toISOString()}] ${msg}`),
    error: (msg: string) => console.error(`[ERROR] [${new Date().toISOString()}] ${msg}`),
  };

  const collect = deps?.collectFn || collectDockerTelemetry;
  const send = deps?.sendFn || sendHeartbeat;

  logger.info(
    `Starting DevWeave Windows Docker Runner (${config.runnerId}) -> target: ${config.backendUrl} (interval: ${config.intervalMs / 1000}s)`,
  );

  let isRunning = false;
  let isStopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const runIteration = async () => {
    if (isStopped || isRunning) return;
    isRunning = true;
    try {
      const { snapshot, dockerAvailable } = await collect(config.runnerId);
      if (isStopped) return;

      const res = await send(snapshot, config);
      if (isStopped) return;

      if (res.success) {
        logger.info(
          `Heartbeat accepted [Docker: ${dockerAvailable ? 'ONLINE' : 'OFFLINE'}, Containers: ${snapshot.containersRunning}/${snapshot.containersTotal}, Images: ${snapshot.imagesTotal}]`,
        );
      } else {
        logger.warn(
          `Heartbeat dispatch failed: ${res.error || `HTTP ${res.status}`}. Retrying in ${config.intervalMs / 1000}s...`,
        );
      }
    } catch (error) {
      if (isStopped) return;
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Telemetry collection or dispatch error: ${msg}`);
    } finally {
      isRunning = false;
    }
  };

  // Run initial heartbeat immediately
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
      logger.info('Docker Runner stopped gracefully.');
    },
  };
}

// Automatically start if executed as main CLI entry point
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  try {
    const config = loadRunnerConfig();
    const runner = startDockerRunner(config);

    const shutdown = () => {
      runner.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error(
      `[FATAL] Failed to start Docker runner: ${error instanceof Error ? error.message : error}`,
    );
    process.exit(1);
  }
}
