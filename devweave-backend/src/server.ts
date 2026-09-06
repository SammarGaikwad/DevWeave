import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';

async function startServer(): Promise<void> {
  await connectDatabase();

  const server = app.listen(env.PORT, () => {
    console.log(`🚀 DevWeave Backend running at http://localhost:${env.PORT}`);
    console.log(`   Environment: ${env.NODE_ENV}`);
    console.log(`   Frontend CORS allowed: ${env.FRONTEND_URL}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}. Shutting down server gracefully...`);
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('Failed to start DevWeave Backend server:', err);
  process.exit(1);
});
