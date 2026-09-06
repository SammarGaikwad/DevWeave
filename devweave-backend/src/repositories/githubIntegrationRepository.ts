import { GithubIntegration } from '@prisma/client';
import { prisma, isDbAvailable, markDbOffline } from '../config/database.js';

const memoryIntegrations = new Map<string, GithubIntegration>();

export async function findGithubIntegrationByUserId(
  userId: string
): Promise<GithubIntegration | null> {
  if (await isDbAvailable()) {
    try {
      const integration = await prisma.githubIntegration.findUnique({
        where: { userId },
      });
      if (integration) {
        memoryIntegrations.set(userId, integration);
      }
      return integration;
    } catch {
      markDbOffline();
    }
  }

  return memoryIntegrations.get(userId) || null;
}

export async function deleteGithubIntegrationByUserId(userId: string): Promise<boolean> {
  if (await isDbAvailable()) {
    try {
      await prisma.githubIntegration.delete({
        where: { userId },
      });
      memoryIntegrations.delete(userId);
      return true;
    } catch {
      markDbOffline();
    }
  }

  memoryIntegrations.delete(userId);
  return true;
}
