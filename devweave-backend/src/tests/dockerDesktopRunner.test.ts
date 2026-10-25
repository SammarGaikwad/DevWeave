import { describe, expect, it, vi } from 'vitest';
import {
  collectDockerTelemetry,
  loadRunnerConfig,
  sendHeartbeat,
  startDockerRunner,
} from '../runner/dockerDesktopRunner.js';
import { pollForJob, executeBuildJob } from '../runner/dockerJobExecutor.js';
import { executeManagementJob } from '../runner/dockerManagementExecutor.js';

describe('Docker Desktop Runner Module', () => {
  describe('loadRunnerConfig', () => {
    it('throws an error if DOCKER_RUNNER_TOKEN is missing', () => {
      const originalToken = process.env.DOCKER_RUNNER_TOKEN;
      delete process.env.DOCKER_RUNNER_TOKEN;

      try {
        expect(() => loadRunnerConfig()).toThrow(
          /DOCKER_RUNNER_TOKEN environment variable is required/i,
        );
      } finally {
        process.env.DOCKER_RUNNER_TOKEN = originalToken;
      }
    });

    it('loads configured values correctly', () => {
      const originalToken = process.env.DOCKER_RUNNER_TOKEN;
      const originalRunnerId = process.env.DOCKER_RUNNER_ID;
      const originalBackend = process.env.DEVWEAVE_BACKEND_URL;

      process.env.DOCKER_RUNNER_TOKEN = 'test_token_123456789012345678901234567890';
      process.env.DOCKER_RUNNER_ID = 'test-runner-desktop';
      process.env.DEVWEAVE_BACKEND_URL = 'https://devweave-api.test';

      try {
        const config = loadRunnerConfig();
        expect(config.runnerToken).toBe('test_token_123456789012345678901234567890');
        expect(config.runnerId).toBe('test-runner-desktop');
        expect(config.backendUrl).toBe('https://devweave-api.test');
        expect(config.intervalMs).toBe(10000);
        expect(config.timeoutMs).toBe(8000);
      } finally {
        process.env.DOCKER_RUNNER_TOKEN = originalToken;
        if (originalRunnerId) process.env.DOCKER_RUNNER_ID = originalRunnerId;
        else delete process.env.DOCKER_RUNNER_ID;
        if (originalBackend) process.env.DEVWEAVE_BACKEND_URL = originalBackend;
        else delete process.env.DEVWEAVE_BACKEND_URL;
      }
    });
  });

  describe('collectDockerTelemetry', () => {
    it('accurately parses Docker stats when Docker is healthy', async () => {
      const mockExec = vi.fn().mockImplementation(async (cmd: string) => {
        if (cmd === 'docker --version') {
          return { stdout: 'Docker version 29.8.2, build 7fc2dff\n' };
        }
        if (cmd.startsWith('docker info')) {
          return { stdout: '29.8.2|2|5|12\n' };
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const { snapshot, dockerAvailable } = await collectDockerTelemetry(
        'windows-runner-test',
        mockExec,
      );

      expect(dockerAvailable).toBe(true);
      expect(snapshot.runnerId).toBe('windows-runner-test');
      expect(snapshot.dockerVersion).toBe('Docker version 29.8.2, build 7fc2dff');
      expect(snapshot.serverVersion).toBe('29.8.2');
      expect(snapshot.containersRunning).toBe(2);
      expect(snapshot.containersTotal).toBe(5);
      expect(snapshot.imagesTotal).toBe(12);
      expect(snapshot.hostname).toBeDefined();
      expect(snapshot.reportedAt).toBeDefined();
    });

    it('handles Docker daemon offline gracefully', async () => {
      const mockExec = vi.fn().mockImplementation(async (cmd: string) => {
        if (cmd === 'docker --version') {
          return { stdout: 'Docker version 29.8.2, build 7fc2dff\n' };
        }
        throw new Error('error during connect: daemon not running');
      });

      const { snapshot, dockerAvailable } = await collectDockerTelemetry(
        'windows-runner-offline',
        mockExec,
      );

      expect(dockerAvailable).toBe(false);
      expect(snapshot.dockerVersion).toBe('Docker version 29.8.2, build 7fc2dff');
      expect(snapshot.serverVersion).toBeNull();
      expect(snapshot.containersRunning).toBe(0);
      expect(snapshot.containersTotal).toBe(0);
      expect(snapshot.imagesTotal).toBe(0);
    });

    it('handles Docker CLI missing entirely from system', async () => {
      const mockExec = vi.fn().mockRejectedValue(new Error('command not found: docker'));

      const { snapshot, dockerAvailable } = await collectDockerTelemetry(
        'windows-runner-no-docker',
        mockExec,
      );

      expect(dockerAvailable).toBe(false);
      expect(snapshot.dockerVersion).toBeNull();
      expect(snapshot.serverVersion).toBeNull();
      expect(snapshot.containersRunning).toBe(0);
      expect(snapshot.containersTotal).toBe(0);
      expect(snapshot.imagesTotal).toBe(0);
    });

    it('clamps running containers count if Docker reports running > total', async () => {
      const mockExec = vi.fn().mockImplementation(async (cmd: string) => {
        if (cmd === 'docker --version') {
          return { stdout: 'Docker version 29.8.2\n' };
        }
        return { stdout: '29.8.2|10|5|3\n' };
      });

      const { snapshot } = await collectDockerTelemetry('windows-runner-clamp', mockExec);
      expect(snapshot.containersRunning).toBe(5);
      expect(snapshot.containersTotal).toBe(5);
    });
  });

  describe('sendHeartbeat', () => {
    const validSnapshot = {
      runnerId: 'windows-runner',
      hostname: 'test-host',
      dockerVersion: 'Docker version test',
      serverVersion: '29.0.0',
      containersRunning: 1,
      containersTotal: 3,
      imagesTotal: 5,
      reportedAt: new Date().toISOString(),
    };

    it('successfully dispatches heartbeat with Bearer token', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 202,
        json: async () => ({ success: true }),
      });

      const res = await sendHeartbeat(
        validSnapshot,
        {
          backendUrl: 'https://devweave-api.test',
          runnerToken: 'secret-token-value-1234567890123456',
          timeoutMs: 5000,
        },
        mockFetch as unknown as typeof fetch,
      );

      expect(res.success).toBe(true);
      expect(res.status).toBe(202);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://devweave-api.test/api/v1/docker/runner/heartbeat',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer secret-token-value-1234567890123456',
          },
        }),
      );
    });

    it('handles non-2xx HTTP responses safely without throwing', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Too many requests',
      });

      const res = await sendHeartbeat(
        validSnapshot,
        {
          backendUrl: 'https://devweave-api.test',
          runnerToken: 'secret-token',
          timeoutMs: 5000,
        },
        mockFetch as unknown as typeof fetch,
      );

      expect(res.success).toBe(false);
      expect(res.status).toBe(429);
      expect(res.error).toContain('HTTP 429');
    });

    it('handles network timeouts / connection aborts safely without throwing', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('The operation was aborted due to timeout'));

      const res = await sendHeartbeat(
        validSnapshot,
        {
          backendUrl: 'https://devweave-api.test',
          runnerToken: 'secret-token',
          timeoutMs: 5000,
        },
        mockFetch as unknown as typeof fetch,
      );

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/aborted due to timeout/i);
    });

    it('handles network connection failures (e.g. ECONNREFUSED) without throwing', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5000'));

      const res = await sendHeartbeat(
        validSnapshot,
        {
          backendUrl: 'http://localhost:5000',
          runnerToken: 'secret-token',
          timeoutMs: 5000,
        },
        mockFetch as unknown as typeof fetch,
      );

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/ECONNREFUSED/i);
    });

    it('clears request timeout in finally block for every outcome (2xx, error, network failure, abort)', async () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

      try {
        // 1. Successful response
        const successFetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 202,
          json: async () => ({ success: true }),
        });
        await sendHeartbeat(
          validSnapshot,
          { backendUrl: 'https://test.api', runnerToken: 'token', timeoutMs: 5000 },
          successFetch as unknown as typeof fetch,
        );
        expect(clearTimeoutSpy).toHaveBeenCalled();

        clearTimeoutSpy.mockClear();

        // 2. Non-2xx response
        const errorFetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        });
        await sendHeartbeat(
          validSnapshot,
          { backendUrl: 'https://test.api', runnerToken: 'token', timeoutMs: 5000 },
          errorFetch as unknown as typeof fetch,
        );
        expect(clearTimeoutSpy).toHaveBeenCalled();

        clearTimeoutSpy.mockClear();

        // 3. Network error
        const rejectFetch = vi.fn().mockRejectedValue(new Error('Network unreachable'));
        await sendHeartbeat(
          validSnapshot,
          { backendUrl: 'https://test.api', runnerToken: 'token', timeoutMs: 5000 },
          rejectFetch as unknown as typeof fetch,
        );
        expect(clearTimeoutSpy).toHaveBeenCalled();

        clearTimeoutSpy.mockClear();

        // 4. Abort / Timeout error
        const abortFetch = vi.fn().mockRejectedValue(new DOMException('The user aborted a request.', 'AbortError'));
        await sendHeartbeat(
          validSnapshot,
          { backendUrl: 'https://test.api', runnerToken: 'token', timeoutMs: 5000 },
          abortFetch as unknown as typeof fetch,
        );
        expect(clearTimeoutSpy).toHaveBeenCalled();
      } finally {
        clearTimeoutSpy.mockRestore();
      }
    });
  });

  describe('startDockerRunner', () => {
    it('executes an initial cycle and can be stopped cleanly', async () => {
      const mockCollect = vi.fn().mockResolvedValue({
        snapshot: {
          runnerId: 'test-runner',
          hostname: 'host',
          dockerVersion: '29.0.0',
          serverVersion: '29.0.0',
          containersRunning: 0,
          containersTotal: 0,
          imagesTotal: 0,
          reportedAt: new Date().toISOString(),
        },
        dockerAvailable: true,
      });

      const mockSend = vi.fn().mockResolvedValue({ success: true, status: 202 });
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const runner = startDockerRunner(
        {
          runnerId: 'test-runner',
          backendUrl: 'https://devweave.test',
          runnerToken: 'test-token',
          intervalMs: 10000,
          timeoutMs: 5000,
        },
        {
          collectFn: mockCollect as unknown as typeof collectDockerTelemetry,
          sendFn: mockSend as unknown as typeof sendHeartbeat,
          logger: mockLogger,
        },
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting DevWeave Windows Docker Runner'),
      );

      // Verify clean stop
      runner.stop();
      expect(mockLogger.info).toHaveBeenCalledWith('Docker Runner stopped gracefully.');
    });

    it('handles in-flight collection safely when stop() is invoked before collect resolves', async () => {
      let resolveCollect!: (val: unknown) => void;
      const collectPromise = new Promise((resolve) => {
        resolveCollect = resolve;
      });
      const mockCollect = vi.fn().mockReturnValue(collectPromise);
      const mockSend = vi.fn().mockResolvedValue({ success: true, status: 202 });
      const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

      const runner = startDockerRunner(
        {
          runnerId: 'test-runner',
          backendUrl: 'https://devweave.test',
          runnerToken: 'test-token',
          intervalMs: 10000,
          timeoutMs: 5000,
        },
        {
          collectFn: mockCollect as unknown as typeof collectDockerTelemetry,
          sendFn: mockSend as unknown as typeof sendHeartbeat,
          logger: mockLogger,
        },
      );

      // Stop while collect is pending
      runner.stop();
      expect(mockLogger.info).toHaveBeenCalledWith('Docker Runner stopped gracefully.');

      // Resolve in-flight collect
      resolveCollect({
        snapshot: {
          runnerId: 'test-runner',
          hostname: 'host',
          dockerVersion: '29.0.0',
          serverVersion: '29.0.0',
          containersRunning: 0,
          containersTotal: 0,
          imagesTotal: 0,
          reportedAt: new Date().toISOString(),
        },
        dockerAvailable: true,
      });
      await Promise.resolve();
      await Promise.resolve();

      // Send should not have been called after stop
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('handles in-flight heartbeat dispatch safely when stop() is invoked before send resolves', async () => {
      let resolveSend!: (val: unknown) => void;
      const sendPromise = new Promise((resolve) => {
        resolveSend = resolve;
      });
      const mockCollect = vi.fn().mockResolvedValue({
        snapshot: {
          runnerId: 'test-runner',
          hostname: 'host',
          dockerVersion: '29.0.0',
          serverVersion: '29.0.0',
          containersRunning: 0,
          containersTotal: 0,
          imagesTotal: 0,
          reportedAt: new Date().toISOString(),
        },
        dockerAvailable: true,
      });
      const mockSend = vi.fn().mockReturnValue(sendPromise);
      const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

      const runner = startDockerRunner(
        {
          runnerId: 'test-runner',
          backendUrl: 'https://devweave.test',
          runnerToken: 'test-token',
          intervalMs: 10000,
          timeoutMs: 5000,
        },
        {
          collectFn: mockCollect as unknown as typeof collectDockerTelemetry,
          sendFn: mockSend as unknown as typeof sendHeartbeat,
          logger: mockLogger,
        },
      );

      await Promise.resolve();
      await Promise.resolve();
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Stop runner while send is pending
      runner.stop();
      expect(mockLogger.info).toHaveBeenCalledWith('Docker Runner stopped gracefully.');

      // Resolve in-flight send
      resolveSend({ success: true, status: 202 });
      await Promise.resolve();
      await Promise.resolve();

      // Post-shutdown info logs should not include "Heartbeat accepted"
      const heartbeatAcceptedLogs = mockLogger.info.mock.calls.filter((call) =>
        String(call[0]).includes('Heartbeat accepted'),
      );
      expect(heartbeatAcceptedLogs).toHaveLength(0);
    });

    it('handles in-flight failure safely during shutdown without unhandled rejections', async () => {
      let rejectCollect!: (err: Error) => void;
      const collectPromise = new Promise((_, reject) => {
        rejectCollect = reject;
      });
      const mockCollect = vi.fn().mockReturnValue(collectPromise);
      const mockSend = vi.fn().mockResolvedValue({ success: true, status: 202 });
      const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

      const runner = startDockerRunner(
        {
          runnerId: 'test-runner',
          backendUrl: 'https://devweave.test',
          runnerToken: 'test-token',
          intervalMs: 10000,
          timeoutMs: 5000,
        },
        {
          collectFn: mockCollect as unknown as typeof collectDockerTelemetry,
          sendFn: mockSend as unknown as typeof sendHeartbeat,
          logger: mockLogger,
        },
      );

      runner.stop();

      // Reject in-flight promise after stop
      rejectCollect(new Error('Process terminated during shutdown'));
      await Promise.resolve();
      await Promise.resolve();

      // Should not log error when stopped
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('prevents overlapping heartbeat cycles when an iteration is already running', async () => {
      vi.useFakeTimers();
      try {
        let resolveCollect!: (val: unknown) => void;
        const pendingCollectPromise = new Promise((resolve) => {
          resolveCollect = resolve;
        });

        const mockCollect = vi.fn().mockReturnValue(pendingCollectPromise);
        const mockSend = vi.fn().mockResolvedValue({ success: true, status: 202 });
        const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

        const runner = startDockerRunner(
          {
            runnerId: 'test-runner',
            backendUrl: 'https://devweave.test',
            runnerToken: 'test-token',
            intervalMs: 10000,
            timeoutMs: 5000,
          },
          {
            collectFn: mockCollect as unknown as typeof collectDockerTelemetry,
            sendFn: mockSend as unknown as typeof sendHeartbeat,
            logger: mockLogger,
          },
        );

        expect(mockCollect).toHaveBeenCalledTimes(1);

        // Advance timer past the interval
        vi.advanceTimersByTime(10000);

        // Overlapping cycle should have been prevented
        expect(mockCollect).toHaveBeenCalledTimes(1);

        // Resolve pending collect
        resolveCollect({
          snapshot: {
            runnerId: 'test-runner',
            hostname: 'host',
            dockerVersion: '29.0.0',
            serverVersion: '29.0.0',
            containersRunning: 0,
            containersTotal: 0,
            imagesTotal: 0,
            reportedAt: new Date().toISOString(),
          },
          dockerAvailable: true,
        });
        await Promise.resolve();

        runner.stop();
      } finally {
        vi.useRealTimers();
      }
    });

    it('prevents new heartbeat cycles after stop() is called when interval triggers', async () => {
      vi.useFakeTimers();
      try {
        const mockCollect = vi.fn().mockResolvedValue({
          snapshot: {
            runnerId: 'test-runner',
            hostname: 'host',
            dockerVersion: '29.0.0',
            serverVersion: '29.0.0',
            containersRunning: 0,
            containersTotal: 0,
            imagesTotal: 0,
            reportedAt: new Date().toISOString(),
          },
          dockerAvailable: true,
        });
        const mockSend = vi.fn().mockResolvedValue({ success: true, status: 202 });
        const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

        const runner = startDockerRunner(
          {
            runnerId: 'test-runner',
            backendUrl: 'https://devweave.test',
            runnerToken: 'test-token',
            intervalMs: 10000,
            timeoutMs: 5000,
          },
          {
            collectFn: mockCollect as unknown as typeof collectDockerTelemetry,
            sendFn: mockSend as unknown as typeof sendHeartbeat,
            logger: mockLogger,
          },
        );

        expect(mockCollect).toHaveBeenCalledTimes(1);

        runner.stop();

        // Advance timer by multiple intervals
        vi.advanceTimersByTime(30000);

        // Should not have run any additional cycles
        expect(mockCollect).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('is idempotent when stop() is invoked multiple times', () => {
      const mockCollect = vi.fn().mockResolvedValue({
        snapshot: {
          runnerId: 'test-runner',
          hostname: 'host',
          dockerVersion: '29.0.0',
          serverVersion: '29.0.0',
          containersRunning: 0,
          containersTotal: 0,
          imagesTotal: 0,
          reportedAt: new Date().toISOString(),
        },
        dockerAvailable: true,
      });
      const mockSend = vi.fn().mockResolvedValue({ success: true, status: 202 });
      const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

      const runner = startDockerRunner(
        {
          runnerId: 'test-runner',
          backendUrl: 'https://devweave.test',
          runnerToken: 'test-token',
          intervalMs: 10000,
          timeoutMs: 5000,
        },
        {
          collectFn: mockCollect as unknown as typeof collectDockerTelemetry,
          sendFn: mockSend as unknown as typeof sendHeartbeat,
          logger: mockLogger,
        },
      );

      runner.stop();
      runner.stop();
      runner.stop();

      const stopLogs = mockLogger.info.mock.calls.filter(
        (call) => call[0] === 'Docker Runner stopped gracefully.',
      );
      expect(stopLogs).toHaveLength(1);
    });
  });

  describe('dockerJobExecutor: pollForJob & executeBuildJob', () => {
    const config = {
      runnerId: 'windows-docker-runner',
      backendUrl: 'https://devweave-api.test',
      runnerToken: 'runner-test-token-12345678901234567890',
      intervalMs: 10000,
      timeoutMs: 8000,
    };

    it('successfully parses and claims job when available', async () => {
      const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const mockPayload = {
        id: 'job-123',
        repoFullName: 'owner/repo',
        branch: 'main',
        imageTag: 'repo:v1',
        dockerfile: 'FROM alpine',
        dockerignore: '.git',
        timeoutSeconds: 300,
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: mockPayload }),
      });

      const job = await pollForJob(config, {
        logger: mockLogger,
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(job).toEqual(mockPayload);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[Job Poll] Claimed build job: job-123 (repo:v1)')
      );
    });

    it('returns null and logs when no jobs are available', async () => {
      const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: null }),
      });

      const job = await pollForJob(config, {
        logger: mockLogger,
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(job).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[Job Poll] No queued build jobs available.'
      );
    });

    it('logs warning on non-200 HTTP response and does not leak token', async () => {
      const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const job = await pollForJob(config, {
        logger: mockLogger,
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(job).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('HTTP 401 (Unauthorized)')
      );
      // Ensure token is never in log output
      for (const call of mockLogger.warn.mock.calls) {
        expect(call[0]).not.toContain(config.runnerToken);
      }
    });

    it('handles request timeout (AbortError) safely', async () => {
      const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      const mockFetch = vi.fn().mockRejectedValue(abortError);

      const job = await pollForJob(config, {
        logger: mockLogger,
        fetchFn: mockFetch as unknown as typeof fetch,
        timeoutMs: 100,
      });

      expect(job).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Request timed out after 100ms')
      );
    });

    it('rejects malformed poll response schema safely', async () => {
      const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { invalidKey: 123 } }),
      });

      const job = await pollForJob(config, {
        logger: mockLogger,
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(job).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid job poll response schema')
      );
    });

    it('aborts build and reports failure if archive download fails before docker build', async () => {
      const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const completedCalls: any[] = [];

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/archive')) {
          return { ok: false, status: 502, statusText: 'Bad Gateway' };
        }
        if (url.includes('/logs')) {
          return { ok: true, json: async () => ({ success: true }) };
        }
        if (url.includes('/complete')) {
          return {
            ok: true,
            json: async () => {
              completedCalls.push(JSON.parse(mockFetch.mock.calls.at(-1)?.[1]?.body || '{}'));
              return { success: true };
            },
          };
        }
        return { ok: true };
      });

      await executeBuildJob(
        {
          id: 'fail-job-1',
          repoFullName: 'owner/repo',
          branch: 'main',
          imageTag: 'fail-img:v1',
          dockerfile: 'FROM alpine',
          dockerignore: '',
          timeoutSeconds: 300,
        },
        config,
        mockLogger,
        mockFetch as unknown as typeof fetch
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to download repository source archive (HTTP 502: Bad Gateway)')
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/complete'),
        expect.objectContaining({
          body: expect.stringContaining('"success":false'),
        })
      );
    });
  });

  describe('dockerManagementExecutor: Resource Protection & Execution Safety', () => {
    const config = {
      runnerId: 'windows-docker-runner',
      backendUrl: 'https://devweave-api.test',
      runnerToken: 'runner-test-token-12345678901234567890',
      intervalMs: 10000,
      timeoutMs: 8000,
    };

    const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const createMockDockerExec = () => {
      const executedCommands: string[][] = [];
      const mockExec = vi.fn().mockImplementation(async (args: string[]) => {
        executedCommands.push(args);
        const cmdStr = args.join(' ');

        if (cmdStr.startsWith('ps -a')) {
          return {
            stdout: [
              JSON.stringify({
                ID: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                Names: '/smart_review_backend_api',
                Image: 'smart-review-analytics:latest',
                State: 'running',
              }),
              JSON.stringify({
                ID: 'f4c1d2e3b4a567890123456789abcdef0123456789abcdef0123456789abcdef',
                Names: '/smart_review_analytics_engine',
                Image: 'sha256:dangling00000000000000000000000000000000000000000000000000000000',
                State: 'running',
              }),
              JSON.stringify({
                ID: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef',
                Names: '/jenkins',
                Image: 'jenkins/jenkins:lts',
                State: 'running',
              }),
              JSON.stringify({
                ID: 'd9e8f7a6b5c41111111111abcdef1234567890abcdef1234567890abcdef',
                Names: '/user-app-one',
                Image: 'user-app:1.0',
                State: 'running',
              }),
              JSON.stringify({
                ID: 'd9e8f7a6b5c42222222222abcdef1234567890abcdef1234567890abcdef',
                Names: '/user-app-two',
                Image: 'user-app:2.0',
                State: 'exited',
              }),
            ].join('\n'),
            stderr: '',
          };
        }

        if (cmdStr.startsWith('images')) {
          return {
            stdout: [
              JSON.stringify({
                ID: 'sha256:0a620eef77501234567890abcdef1234567890abcdef1234567890abcdef',
                Repository: 'smart-review-analytics',
                Tag: 'latest',
              }),
              JSON.stringify({
                ID: 'sha256:2c842aa199721234567890abcdef1234567890abcdef1234567890abcdef',
                Repository: 'jenkins/jenkins',
                Tag: 'lts',
              }),
              JSON.stringify({
                ID: 'sha256:dangling00000000000000000000000000000000000000000000000000000000',
                Repository: '<none>',
                Tag: '<none>',
              }),
              JSON.stringify({
                ID: 'sha256:3d953bb2aa831234567890abcdef1234567890abcdef1234567890abcdef',
                Repository: 'user-app',
                Tag: '1.0',
              }),
            ].join('\n'),
            stderr: '',
          };
        }

        if (cmdStr.startsWith('network ls')) {
          return {
            stdout: [
              JSON.stringify({
                ID: '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
                Name: 'bridge',
                Driver: 'bridge',
              }),
              JSON.stringify({
                ID: '222233334444555566667777888899990000aaaabbbbccccddddeeeeffff1111',
                Name: 'smart-review-analytics_smart_review_network',
                Driver: 'bridge',
              }),
              JSON.stringify({
                ID: '33334444555566667777888899990000aaaabbbbccccddddeeeeffff22223333',
                Name: 'user-network',
                Driver: 'bridge',
              }),
            ].join('\n'),
            stderr: '',
          };
        }

        if (cmdStr.startsWith('volume ls')) {
          return {
            stdout: [
              JSON.stringify({ Name: 'jenkins_home', Driver: 'local' }),
              JSON.stringify({ Name: 'user-vol', Driver: 'local' }),
            ].join('\n'),
            stderr: '',
          };
        }

        if (cmdStr.startsWith('inspect')) {
          return {
            stdout: JSON.stringify([
              {
                Id: 'd9e8f7a6b5c41111111111abcdef1234567890abcdef1234567890abcdef',
                Name: '/user-app-one',
                Config: { Image: 'user-app:1.0' },
                HostConfig: { RestartPolicy: { Name: 'unless-stopped' }, NetworkMode: 'bridge' },
              },
            ]),
            stderr: '',
          };
        }

        return { stdout: 'mock-output', stderr: '' };
      });

      return { mockExec, executedCommands };
    };

    it('runner blocks stopping protected container targeted by name or ID prefix', async () => {
      const { mockExec, executedCommands } = createMockDockerExec();
      let reportedPayload: any = null;
      const mockFetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        if (url.includes('/complete')) {
          reportedPayload = JSON.parse(opts.body);
        }
        return { ok: true, json: async () => ({ success: true }) };
      });

      // Stop by name
      await executeManagementJob(
        { id: 'job-p1', jobType: 'MANAGEMENT', actionType: 'CONTAINER_STOP', params: { containerId: 'jenkins' } },
        config,
        mockLogger,
        mockFetch as unknown as typeof fetch,
        mockExec
      );

      expect(reportedPayload.success).toBe(false);
      expect(reportedPayload.error).toMatch(/Execution blocked: Container 'jenkins' is a protected production resource/);
      expect(executedCommands.some((c) => c[0] === 'stop')).toBe(false);

      // Stop by ID prefix
      await executeManagementJob(
        { id: 'job-p2', jobType: 'MANAGEMENT', actionType: 'CONTAINER_STOP', params: { containerId: 'e3b0c44298fc' } },
        config,
        mockLogger,
        mockFetch as unknown as typeof fetch,
        mockExec
      );

      expect(reportedPayload.success).toBe(false);
      expect(reportedPayload.error).toMatch(/protected production resource/);
      expect(executedCommands.some((c) => c[0] === 'stop')).toBe(false);
    });

    it('runner blocks network disconnect targeting protected container', async () => {
      const { mockExec, executedCommands } = createMockDockerExec();
      let reportedPayload: any = null;
      const mockFetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        if (url.includes('/complete')) {
          reportedPayload = JSON.parse(opts.body);
        }
        return { ok: true, json: async () => ({ success: true }) };
      });

      await executeManagementJob(
        {
          id: 'job-net-disc',
          jobType: 'MANAGEMENT',
          actionType: 'NETWORK_DISCONNECT',
          params: { networkIdOrName: 'user-network', containerId: 'jenkins' },
        },
        config,
        mockLogger,
        mockFetch as unknown as typeof fetch,
        mockExec
      );

      expect(reportedPayload.success).toBe(false);
      expect(reportedPayload.error).toMatch(/protected production resource/);
      expect(executedCommands.some((c) => c[0] === 'network' && c[1] === 'disconnect')).toBe(false);
    });

    it('runner blocks recreate targeting protected container or hijacking protected name', async () => {
      const { mockExec, executedCommands } = createMockDockerExec();
      let reportedPayload: any = null;
      const mockFetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        if (url.includes('/complete')) {
          reportedPayload = JSON.parse(opts.body);
        }
        return { ok: true, json: async () => ({ success: true }) };
      });

      // Target jenkins
      await executeManagementJob(
        {
          id: 'job-recreate-1',
          jobType: 'MANAGEMENT',
          actionType: 'CONTAINER_RECREATE',
          params: { containerId: 'jenkins' },
        },
        config,
        mockLogger,
        mockFetch as unknown as typeof fetch,
        mockExec
      );

      expect(reportedPayload.success).toBe(false);
      expect(reportedPayload.error).toMatch(/protected production resource/);

      // Recreate user container but renaming to smart_review_backend_api
      await executeManagementJob(
        {
          id: 'job-recreate-2',
          jobType: 'MANAGEMENT',
          actionType: 'CONTAINER_RECREATE',
          params: { containerId: 'd9e8f7a6b5c41111', name: 'smart_review_backend_api' },
        },
        config,
        mockLogger,
        mockFetch as unknown as typeof fetch,
        mockExec
      );

      expect(reportedPayload.success).toBe(false);
      expect(reportedPayload.error).toMatch(/protected/);
      expect(executedCommands.some((c) => c[0] === 'rm')).toBe(false);
    });

    it('runner blocks protected network and volume deletions', async () => {
      const { mockExec, executedCommands } = createMockDockerExec();
      let reportedPayload: any = null;
      const mockFetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        if (url.includes('/complete')) {
          reportedPayload = JSON.parse(opts.body);
        }
        return { ok: true, json: async () => ({ success: true }) };
      });

      // Protected network delete
      await executeManagementJob(
        {
          id: 'job-net-del',
          jobType: 'MANAGEMENT',
          actionType: 'NETWORK_DELETE',
          params: { networkIdOrName: 'smart-review-analytics_smart_review_network' },
        },
        config,
        mockLogger,
        mockFetch as unknown as typeof fetch,
        mockExec
      );

      expect(reportedPayload.success).toBe(false);
      expect(reportedPayload.error).toMatch(/protected system network/);
      expect(executedCommands.some((c) => c[0] === 'network' && c[1] === 'rm')).toBe(false);

      // Protected volume delete
      await executeManagementJob(
        {
          id: 'job-vol-del',
          jobType: 'MANAGEMENT',
          actionType: 'VOLUME_DELETE',
          params: { volumeName: 'jenkins_home' },
        },
        config,
        mockLogger,
        mockFetch as unknown as typeof fetch,
        mockExec
      );

      expect(reportedPayload.success).toBe(false);
      expect(reportedPayload.error).toMatch(/protected persistent volume/);
      expect(executedCommands.some((c) => c[0] === 'volume' && c[1] === 'rm')).toBe(false);
    });

    it('runner blocks protected image delete and prune when protected containers are affected', async () => {
      const { mockExec, executedCommands } = createMockDockerExec();
      let reportedPayload: any = null;
      const mockFetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        if (url.includes('/complete')) {
          reportedPayload = JSON.parse(opts.body);
        }
        return { ok: true, json: async () => ({ success: true }) };
      });

      // Delete protected family image
      await executeManagementJob(
        {
          id: 'job-img-del-1',
          jobType: 'MANAGEMENT',
          actionType: 'IMAGE_DELETE',
          params: { imageIdOrTag: 'jenkins/jenkins:lts' },
        },
        config,
        mockLogger,
        mockFetch as unknown as typeof fetch,
        mockExec
      );

      expect(reportedPayload.success).toBe(false);
      expect(reportedPayload.error).toMatch(/protected/);
      expect(executedCommands.some((c) => c[0] === 'rmi')).toBe(false);

      // Prune when dangling image is in use by smart_review_backend_api
      await executeManagementJob(
        {
          id: 'job-img-prune',
          jobType: 'MANAGEMENT',
          actionType: 'IMAGE_PRUNE_DANGLING',
          params: {},
        },
        config,
        mockLogger,
        mockFetch as unknown as typeof fetch,
        mockExec
      );

      expect(reportedPayload.success).toBe(false);
      expect(reportedPayload.error).toMatch(/protected/);
      expect(executedCommands.some((c) => c[0] === 'image' && c[1] === 'prune')).toBe(false);
    });

    it('runner rejects operations on ambiguous container prefix or daemon failure', async () => {
      const { mockExec } = createMockDockerExec();
      let reportedPayload: any = null;
      const mockFetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        if (url.includes('/complete')) {
          reportedPayload = JSON.parse(opts.body);
        }
        return { ok: true, json: async () => ({ success: true }) };
      });

      // Ambiguous prefix 'd9e8f7a6' matching both user-app-one and user-app-two
      await executeManagementJob(
        {
          id: 'job-ambig',
          jobType: 'MANAGEMENT',
          actionType: 'CONTAINER_STOP',
          params: { containerId: 'd9e8f7a6' },
        },
        config,
        mockLogger,
        mockFetch as unknown as typeof fetch,
        mockExec
      );

      expect(reportedPayload.success).toBe(false);
      expect(reportedPayload.error).toMatch(/Ambiguous container identifier/);

      // Daemon failure
      const failingMockExec = vi.fn().mockRejectedValue(new Error('error connect daemon offline'));
      await executeManagementJob(
        {
          id: 'job-fail',
          jobType: 'MANAGEMENT',
          actionType: 'CONTAINER_STOP',
          params: { containerId: 'user-app-one' },
        },
        config,
        mockLogger,
        mockFetch as unknown as typeof fetch,
        failingMockExec
      );

      expect(reportedPayload.success).toBe(false);
      expect(reportedPayload.error).toMatch(/Docker daemon inventory lookup failed/);
    });

    it('runner executes destructive operations on ordinary user resources', async () => {
      const { mockExec, executedCommands } = createMockDockerExec();
      let reportedPayload: any = null;
      const mockFetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        if (url.includes('/complete')) {
          reportedPayload = JSON.parse(opts.body);
        }
        return { ok: true, json: async () => ({ success: true }) };
      });

      // Stop user container
      await executeManagementJob(
        {
          id: 'job-user-stop',
          jobType: 'MANAGEMENT',
          actionType: 'CONTAINER_STOP',
          params: { containerId: 'user-app-one', timeoutSeconds: 5 },
        },
        config,
        mockLogger,
        mockFetch as unknown as typeof fetch,
        mockExec
      );

      expect(reportedPayload.success).toBe(true);
      expect(executedCommands.some((c) => c[0] === 'stop' && c.includes('user-app-one'))).toBe(true);

      // Delete user container
      await executeManagementJob(
        {
          id: 'job-user-del',
          jobType: 'MANAGEMENT',
          actionType: 'CONTAINER_DELETE',
          params: { containerId: 'user-app-one' },
        },
        config,
        mockLogger,
        mockFetch as unknown as typeof fetch,
        mockExec
      );

      expect(reportedPayload.success).toBe(true);
      expect(executedCommands.some((c) => c[0] === 'rm' && c.includes('user-app-one'))).toBe(true);

      // Delete user network
      await executeManagementJob(
        {
          id: 'job-user-net',
          jobType: 'MANAGEMENT',
          actionType: 'NETWORK_DELETE',
          params: { networkIdOrName: 'user-network' },
        },
        config,
        mockLogger,
        mockFetch as unknown as typeof fetch,
        mockExec
      );

      expect(reportedPayload.success).toBe(true);
      expect(executedCommands.some((c) => c[0] === 'network' && c[1] === 'rm' && c.includes('user-network'))).toBe(true);

      // Delete user volume
      await executeManagementJob(
        {
          id: 'job-user-vol',
          jobType: 'MANAGEMENT',
          actionType: 'VOLUME_DELETE',
          params: { volumeName: 'user-vol' },
        },
        config,
        mockLogger,
        mockFetch as unknown as typeof fetch,
        mockExec
      );

      expect(reportedPayload.success).toBe(true);
      expect(executedCommands.some((c) => c[0] === 'volume' && c[1] === 'rm' && c.includes('user-vol'))).toBe(true);
    });
  });
});
