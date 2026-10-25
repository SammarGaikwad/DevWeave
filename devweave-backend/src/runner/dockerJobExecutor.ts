import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Readable } from 'node:stream';
import { spawn, exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { RunnerConfig } from './dockerDesktopRunner.js';

import { z } from 'zod';

const execAsync = promisify(exec);

export const buildJobPayloadSchema = z.object({
  id: z.string().min(1),
  jobType: z.literal('BUILD').optional(),
  repoFullName: z.string().min(1),
  branch: z.string().min(1),
  imageTag: z.string().min(1),
  dockerfile: z.string().min(1),
  dockerignore: z.string().default(''),
  composeFile: z.string().optional(),
  timeoutSeconds: z.number().int().positive().default(300),
});

export type BuildJobPayload = z.infer<typeof buildJobPayloadSchema>;

export const managementJobPayloadSchema = z.object({
  id: z.string().min(1),
  jobType: z.literal('MANAGEMENT'),
  actionType: z.string().min(1),
  params: z.record(z.any()),
});

export type ManagementJobPayload = z.infer<typeof managementJobPayloadSchema>;

export const runnerJobPayloadSchema = z.union([
  managementJobPayloadSchema,
  buildJobPayloadSchema,
]);

export type RunnerJobPayload = z.infer<typeof runnerJobPayloadSchema>;

export const pollJobResponseSchema = z.object({
  success: z.boolean(),
  data: runnerJobPayloadSchema.nullable(),
});

export interface PollJobOptions {
  logger?: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export async function pollForJob(
  config: RunnerConfig,
  opts?: PollJobOptions | typeof fetch
): Promise<RunnerJobPayload | null> {
  const fetchFn = typeof opts === 'function' ? opts : opts?.fetchFn || fetch;
  const logger = typeof opts === 'object' && opts !== null ? opts.logger : undefined;
  const timeoutMs = typeof opts === 'object' && opts !== null && opts.timeoutMs ? opts.timeoutMs : 8000;

  const pollUrl = `${config.backendUrl}/api/v1/docker/runner/jobs/poll`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchFn(pollUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.runnerToken}`,
      },
      body: JSON.stringify({ runnerId: config.runnerId }),
      signal: controller.signal,
    });

    if (!res.ok) {
      logger?.warn(
        `[Job Poll] Polling endpoint returned HTTP ${res.status}${res.statusText ? ` (${res.statusText})` : ''}`
      );
      return null;
    }

    const rawJson = await res.json().catch(() => null);
    const parsed = pollJobResponseSchema.safeParse(rawJson);

    if (!parsed.success) {
      logger?.warn(`[Job Poll] Received invalid job poll response schema: ${parsed.error.message}`);
      return null;
    }

    if (parsed.data.data) {
      const job = parsed.data.data;
      if ('actionType' in job) {
        logger?.info(
          `[Job Poll] Claimed management job: ${job.id} (${job.actionType})`
        );
      } else {
        logger?.info(
          `[Job Poll] Claimed build job: ${job.id} (${job.imageTag})`
        );
      }
      return job;
    }

    logger?.info('[Job Poll] No queued build jobs available.');
    return null;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      logger?.warn(`[Job Poll] Request timed out after ${timeoutMs}ms.`);
    } else {
      logger?.warn(`[Job Poll] Failed to connect to polling endpoint: ${err?.message || err}`);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function executeBuildJob(
  job: BuildJobPayload,
  config: RunnerConfig,
  logger = {
    info: (msg: string) => console.log(`[INFO] ${msg}`),
    warn: (msg: string) => console.warn(`[WARN] ${msg}`),
    error: (msg: string) => console.error(`[ERROR] ${msg}`),
  },
  fetchFn: typeof fetch = fetch
): Promise<void> {
  const startTime = Date.now();
  const workspace = path.join(os.tmpdir(), 'devweave-runner', job.id);

  logger.info(`Starting build job ${job.id} for image ${job.imageTag} in workspace ${workspace}`);

  const sendLogs = async (
    logs: Array<{ stage?: string; severity?: 'info' | 'warn' | 'error'; message: string }>
  ): Promise<{ cancelRequested: boolean }> => {
    try {
      const res = await fetchFn(`${config.backendUrl}/api/v1/docker/runner/jobs/${job.id}/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.runnerToken}`,
        },
        body: JSON.stringify({ runnerId: config.runnerId, logs }),
      });
      if (res.ok) {
        const data = (await res.json()) as { cancelRequested?: boolean };
        return { cancelRequested: Boolean(data.cancelRequested) };
      }
    } catch (err) {
      logger.warn(`Failed to push logs to backend: ${err}`);
    }
    return { cancelRequested: false };
  };

  const sendComplete = async (result: {
    success: boolean;
    imageId?: string;
    imageSize?: string;
    error?: string;
    durationMs: number;
  }) => {
    try {
      await fetchFn(`${config.backendUrl}/api/v1/docker/runner/jobs/${job.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.runnerToken}`,
        },
        body: JSON.stringify({
          runnerId: config.runnerId,
          ...result,
        }),
      });
    } catch (err) {
      logger.error(`Failed to report job completion: ${err}`);
    }
  };

  try {
    // 1. Prepare isolated workspace
    fs.mkdirSync(workspace, { recursive: true });

    await sendLogs([
      {
        stage: 'init',
        severity: 'info',
        message: `Workspace directory initialized. Target image tag: ${job.imageTag}`,
      },
    ]);

    // 2. Download archive from backend with explicit timeout
    const archivePath = path.join(workspace, 'archive.tar.gz');
    const archiveUrl = `${config.backendUrl}/api/v1/docker/runner/jobs/${job.id}/archive`;

    const archiveController = new AbortController();
    const archiveTimeout = setTimeout(() => archiveController.abort(), 30_000);

    let archiveRes: Response;
    try {
      archiveRes = await fetchFn(archiveUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.runnerToken}`,
        },
        signal: archiveController.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(archiveTimeout);
      const errMsg = `Failed to download repository source archive: ${fetchErr?.message || fetchErr}`;
      logger.error(errMsg);
      await sendLogs([{ stage: 'source', severity: 'error', message: errMsg }]);
      await sendComplete({
        success: false,
        error: errMsg,
        durationMs: Date.now() - startTime,
      });
      return;
    } finally {
      clearTimeout(archiveTimeout);
    }

    if (!archiveRes.ok || !archiveRes.body) {
      const errMsg = `Failed to download repository source archive (HTTP ${archiveRes.status}${
        archiveRes.statusText ? `: ${archiveRes.statusText}` : ''
      })`;
      logger.error(errMsg);
      await sendLogs([{ stage: 'source', severity: 'error', message: errMsg }]);
      await sendComplete({
        success: false,
        error: errMsg,
        durationMs: Date.now() - startTime,
      });
      return;
    }

    const fileStream = fs.createWriteStream(archivePath);
    const readable = ReadableStreamToNodeStream(archiveRes.body);
    await new Promise<void>((resolve, reject) => {
      readable.pipe(fileStream);
      fileStream.on('finish', () => resolve());
      fileStream.on('error', reject);
    });

    // Extract archive using Windows tar or skip if minimal
    const stats = fs.statSync(archivePath);
    if (stats.size > 200) {
      await sendLogs([
        { stage: 'source', severity: 'info', message: 'Extracting repository source snapshot...' },
      ]);
      try {
        await execAsync(`tar -xzf archive.tar.gz`, { cwd: workspace });
        // If extracted into a single subdirectory (GitHub tarball standard), move files up
        const extractedItems = fs.readdirSync(workspace).filter((n) => n !== 'archive.tar.gz');
        if (
          extractedItems.length === 1 &&
          fs.statSync(path.join(workspace, extractedItems[0])).isDirectory()
        ) {
          const subDir = path.join(workspace, extractedItems[0]);
          for (const child of fs.readdirSync(subDir)) {
            fs.renameSync(path.join(subDir, child), path.join(workspace, child));
          }
        }
      } catch (tarErr: any) {
        const errMsg = `Failed to extract repository source archive: ${tarErr?.message || tarErr}`;
        logger.error(errMsg);
        await sendLogs([{ stage: 'source', severity: 'error', message: errMsg }]);
        await sendComplete({
          success: false,
          error: errMsg,
          durationMs: Date.now() - startTime,
        });
        return;
      }
    }

    // 3. Write generated Dockerfile and .dockerignore
    fs.writeFileSync(path.join(workspace, 'Dockerfile'), job.dockerfile, 'utf-8');
    if (job.dockerignore) {
      fs.writeFileSync(path.join(workspace, '.dockerignore'), job.dockerignore, 'utf-8');
    }

    await sendLogs([
      {
        stage: 'dockerfile',
        severity: 'info',
        message: 'Verified Dockerfile and .dockerignore applied to build context.',
      },
      {
        stage: 'build',
        severity: 'info',
        message: `Executing: docker build -t ${job.imageTag} .`,
      },
    ]);

    // 4. Execute Docker build process safely
    let cancelDetected = false;
    const buildProcess = spawn('docker', ['build', '-t', job.imageTag, '.'], {
      cwd: workspace,
      windowsHide: true,
    });

    let logBuffer: Array<{ stage: string; severity: 'info' | 'warn' | 'error'; message: string }> = [];

    const flushLogs = async () => {
      if (logBuffer.length === 0) return;
      const batch = [...logBuffer];
      logBuffer = [];
      const res = await sendLogs(batch);
      if (res.cancelRequested && !cancelDetected) {
        cancelDetected = true;
        buildProcess.kill('SIGTERM');
      }
    };

    const flushInterval = setInterval(() => {
      void flushLogs();
    }, 1000);

    const handleOutput = (data: Buffer, severity: 'info' | 'warn') => {
      const lines = data.toString('utf-8').split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        logBuffer.push({ stage: 'build', severity, message: line.trim() });
      }
    };

    buildProcess.stdout.on('data', (d) => handleOutput(d, 'info'));
    buildProcess.stderr.on('data', (d) => handleOutput(d, 'warn'));

    const exitCode: number = await new Promise((resolve) => {
      buildProcess.on('close', resolve);
      buildProcess.on('error', (err) => {
        logBuffer.push({ stage: 'error', severity: 'error', message: err.message });
        resolve(1);
      });
    });

    clearInterval(flushInterval);
    await flushLogs();

    const durationMs = Date.now() - startTime;

    if (cancelDetected) {
      logger.warn(`Build job ${job.id} cancelled.`);
      await sendComplete({
        success: false,
        error: 'Build was cancelled by user.',
        durationMs,
      });
      return;
    }

    if (exitCode === 0) {
      // Retrieve image ID and size via inspect
      let imageId: string | undefined = undefined;
      let imageSize: string | undefined = undefined;

      try {
        const { stdout } = await execAsync(
          `docker inspect --format="{{.Id}}|{{.Size}}" ${job.imageTag}`
        );
        const [rawId, rawSize] = stdout.trim().split('|');
        if (rawId) imageId = rawId.replace('sha256:', '').slice(0, 12);
        if (rawSize) {
          const bytes = parseInt(rawSize, 10);
          imageSize = !isNaN(bytes)
            ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
            : undefined;
        }
      } catch {
        // Inspect is optional metadata
      }

      logger.info(`Docker build succeeded for ${job.imageTag} (ID: ${imageId}, Size: ${imageSize})`);
      await sendComplete({
        success: true,
        imageId,
        imageSize,
        durationMs,
      });
    } else {
      logger.error(`Docker build failed with exit code ${exitCode}`);
      await sendComplete({
        success: false,
        error: `Docker build exited with code ${exitCode}. Check logs for details.`,
        durationMs,
      });
    }
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Build job error: ${msg}`);
    await sendComplete({
      success: false,
      error: msg,
      durationMs,
    });
  } finally {
    // 5. Secure workspace cleanup
    try {
      if (fs.existsSync(workspace)) {
        fs.rmSync(workspace, { recursive: true, force: true });
      }
    } catch (cleanupErr) {
      logger.warn(`Could not clean up temporary workspace: ${cleanupErr}`);
    }
  }
}

function ReadableStreamToNodeStream(webStream: any) {
  const reader = webStream.getReader();
  return new Readable({
    async read() {
      try {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null);
        } else {
          this.push(Buffer.from(value));
        }
      } catch (err) {
        this.destroy(err as Error);
      }
    },
  });
}
