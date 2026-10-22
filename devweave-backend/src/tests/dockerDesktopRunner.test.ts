import { describe, expect, it, vi } from 'vitest';
import {
  collectDockerTelemetry,
  loadRunnerConfig,
  sendHeartbeat,
  startDockerRunner,
} from '../runner/dockerDesktopRunner.js';

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
});
