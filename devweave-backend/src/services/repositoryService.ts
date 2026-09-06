import * as repositoryRepository from '../repositories/repositoryRepository.js';
import { RepositoryResponse } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';

export async function listRepositories(): Promise<RepositoryResponse[]> {
  const repositories = await repositoryRepository.findAllRepositories();
  return repositories.map((repo) => ({
    id: repo.id,
    externalId: repo.externalId,
    name: repo.name,
    fullName: repo.fullName,
    description: repo.description,
    owner: repo.owner,
    visibility: repo.visibility,
    language: repo.language,
    defaultBranch: repo.defaultBranch,
    stars: repo.stars,
    forks: repo.forks,
    archived: repo.archived,
    sourceProvider: repo.sourceProvider,
    createdAt: repo.createdAt,
    updatedAt: repo.updatedAt,
  }));
}

export async function getRepositoryById(id: string): Promise<RepositoryResponse> {
  const repo = await repositoryRepository.findRepositoryById(id);
  if (!repo) {
    throw new AppError(`Repository not found with ID: ${id}`, 404);
  }

  return {
    id: repo.id,
    externalId: repo.externalId,
    name: repo.name,
    fullName: repo.fullName,
    description: repo.description,
    owner: repo.owner,
    visibility: repo.visibility,
    language: repo.language,
    defaultBranch: repo.defaultBranch,
    stars: repo.stars,
    forks: repo.forks,
    archived: repo.archived,
    sourceProvider: repo.sourceProvider,
    createdAt: repo.createdAt,
    updatedAt: repo.updatedAt,
  };
}
