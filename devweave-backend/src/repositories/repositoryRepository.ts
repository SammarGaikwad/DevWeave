import { Repository } from '@prisma/client';
import { prisma, isDbAvailable, markDbOffline } from '../config/database.js';

const memoryRepositories = new Map<string, Repository>();

export async function findAllRepositories(): Promise<Repository[]> {
  if (await isDbAvailable()) {
    try {
      const repos = await prisma.repository.findMany({
        orderBy: { createdAt: 'desc' },
      });
      for (const repo of repos) {
        memoryRepositories.set(repo.id, repo);
      }
      return repos;
    } catch {
      markDbOffline();
    }
  }

  return Array.from(memoryRepositories.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}

export async function findRepositoryById(id: string): Promise<Repository | null> {
  if (await isDbAvailable()) {
    try {
      const repo = await prisma.repository.findUnique({
        where: { id },
      });
      if (repo) {
        memoryRepositories.set(repo.id, repo);
      }
      return repo;
    } catch {
      markDbOffline();
    }
  }

  return memoryRepositories.get(id) || null;
}

export async function findRepositoriesByUserId(userId: string): Promise<Repository[]> {
  if (await isDbAvailable()) {
    try {
      const repos = await prisma.repository.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      for (const repo of repos) {
        memoryRepositories.set(repo.id, repo);
      }
      return repos;
    } catch {
      markDbOffline();
    }
  }

  return Array.from(memoryRepositories.values())
    .filter((r) => r.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
