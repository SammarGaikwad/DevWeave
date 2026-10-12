import http from 'http';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';

let activeServer: http.Server | null = null;
let isStarting = false;
let signalHandlersRegistered = false;

function registerSignalHandlers(server: http.Server): void {
  if (signalHandlersRegistered) return;
  signalHandlersRegistered = true;

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}. Shutting down server gracefully...`);
    server.close(() => {
      console.log('HTTP server closed.');
      activeServer = null;
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export async function startServer(
  customPort?: number,
  customHost?: string
): Promise<http.Server> {
  if (activeServer) {
    console.warn('⚠️ Server is already running. Skipping redundant start.');
    return activeServer;
  }

  if (isStarting) {
    console.warn('⚠️ Server startup is already in progress.');
    throw new Error('Server startup already in progress');
  }

  isStarting = true;

  try {
    await connectDatabase();

    const rawPort =
      customPort !== undefined
        ? customPort
        : process.env.PORT
          ? parseInt(process.env.PORT, 10)
          : env.PORT;
    const port = Number.isInteger(rawPort) && rawPort >= 0 ? rawPort : 5000;
    const host = customHost ?? '0.0.0.0';

    const server = await new Promise<http.Server>((resolve, reject) => {
      const s = app.listen(port, host, () => {
        resolve(s);
      });

      s.once('error', (err) => {
        reject(err);
      });
    });

    activeServer = server;
    isStarting = false;

    console.log(`🚀 DevWeave Backend running on port ${port}`);
    console.log(`   Host: ${host}`);
    console.log(`   Environment: ${env.NODE_ENV}`);
    console.log(`   Frontend CORS allowed: ${env.FRONTEND_URL}`);

    server.on('error', (err) => {
      console.error('Server runtime error encountered:', err);
    });

    registerSignalHandlers(server);

    return server;
  } catch (err) {
    isStarting = false;
    activeServer = null;
    console.error('Failed to start DevWeave Backend server:', err);
    throw err;
  }
}

export async function stopServer(): Promise<void> {
  if (!activeServer) return;
  return new Promise<void>((resolve, reject) => {
    activeServer!.close((err) => {
      activeServer = null;
      isStarting = false;
      if (err) reject(err);
      else resolve();
    });
  });
}

// Auto-start when executed directly and not running in a test suite
if (process.env.NODE_ENV !== 'test') {
  startServer().catch(() => {
    process.exit(1);
  });
}

