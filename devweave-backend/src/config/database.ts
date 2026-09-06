import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from './env.js';

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

export const prisma = new PrismaClient({
  adapter, 
  log: env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
});

let dbConnectedState: boolean | null = null;

export async function isDbAvailable(): Promise<boolean> {
  if (dbConnectedState !== null) {
    return dbConnectedState;
  }

  try {
    await Promise.race([
      prisma.$connect(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Database connection timeout')),
          5000
        )
      ),
    ]);

    dbConnectedState = true;
    return true;
  } catch {
    dbConnectedState = false;
    return false;
  }
}

export function markDbOffline(): void {
  dbConnectedState = false;
}

export async function connectDatabase(): Promise<void> {
  try {
    const isAvailable = await isDbAvailable();

    if (isAvailable) {
      console.log(
        '✅ PostgreSQL database connected successfully via Prisma'
      );
    } else {
      console.warn(
        '⚠️ PostgreSQL database is offline or unreachable.'
      );
    }
  } catch (error) {
    console.error(
      '❌ Failed to connect to PostgreSQL database:',
      error
    );
  }
}