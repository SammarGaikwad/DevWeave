import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AddressInfo } from 'net';
import http from 'http';
import { startServer, stopServer } from '../server.js';
import * as dbModule from '../config/database.js';

describe('Server Startup and Port-Binding', () => {
  beforeEach(() => {
    vi.spyOn(dbModule, 'connectDatabase').mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await stopServer();
    vi.restoreAllMocks();
  });

  it('should bind the server to 0.0.0.0 and report port/host accurately', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Bind to port 0 (ephemeral port) to avoid colliding with other tests or services
    const server = await startServer(0, '0.0.0.0');

    expect(server).toBeDefined();
    expect(server.listening).toBe(true);

    const address = server.address() as AddressInfo;
    expect(address).toBeDefined();
    expect(address.address).toBe('0.0.0.0');
    expect(address.port).toBeGreaterThan(0);

    // Verify startup logs accurately report port and host without claiming localhost is required
    const logMessages = consoleSpy.mock.calls.map((call) => call.join(' '));
    const runningLog = logMessages.find((msg) => msg.includes('DevWeave Backend running on port'));
    const hostLog = logMessages.find((msg) => msg.includes('Host: 0.0.0.0'));

    expect(runningLog).toBeDefined();
    expect(runningLog).not.toContain('localhost');
    expect(hostLog).toBeDefined();
    expect(hostLog).toContain('0.0.0.0');
  });

  it('should only start listening once when startServer is called redundantly', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const server1 = await startServer(0, '0.0.0.0');
    const server2 = await startServer(0, '0.0.0.0');

    expect(server1).toBe(server2);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Server is already running')
    );
  });

  it('should properly handle and log startup errors when port binding fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // First start server on an ephemeral port
    const firstServer = await startServer(0, '0.0.0.0');
    const addr = firstServer.address() as AddressInfo;
    const takenPort = addr.port;

    await stopServer();

    // Occupy the port with a raw server
    const blocker = http.createServer();
    await new Promise<void>((resolve) => blocker.listen(takenPort, '0.0.0.0', () => resolve()));

    try {
      await expect(startServer(takenPort, '0.0.0.0')).rejects.toThrow();
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to start DevWeave Backend server:',
        expect.any(Error)
      );
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }
  });

  it('should prioritize process.env.PORT over default port', async () => {
    const originalPort = process.env.PORT;
    try {
      process.env.PORT = '0';
      const server = await startServer();
      const addr = server.address() as AddressInfo;
      expect(addr.address).toBe('0.0.0.0');
      expect(addr.port).toBeGreaterThan(0);
    } finally {
      if (originalPort !== undefined) {
        process.env.PORT = originalPort;
      } else {
        delete process.env.PORT;
      }
    }
  });
});
