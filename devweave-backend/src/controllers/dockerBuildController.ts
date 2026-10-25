import type { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authenticate.js';
import { AppError } from '../middleware/errorHandler.js';
import { analyzeProjectFiles, ProjectFileEntry } from '../services/dockerAnalysisService.js';
import { generateDockerConfig } from '../services/dockerGeneratorService.js';
import {
  createBuildJob,
  getBuildJobById,
  listUserBuildJobs,
  cancelBuildJob,
} from '../services/dockerBuildJobService.js';
import * as githubService from '../services/githubService.js';
import * as repoRepo from '../repositories/repositoryRepository.js';

/**
 * Inspects a repository and returns structured analysis of language, framework, ports, and scripts.
 */
export async function analyzeRepository(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }

    const { repoFullName, repositoryId, branch } = req.body;
    if (!repoFullName && !repositoryId) {
      throw new AppError('Repository identifier (repoFullName or repositoryId) is required.', 400);
    }

    const targetBranch = branch || 'main';
    const projectFiles: ProjectFileEntry[] = [];

    // If repositoryId is provided, look up repository or verify authorization
    let resolvedFullName = repoFullName;
    if (repositoryId) {
      const repo = await repoRepo.findRepositoryById(repositoryId);
      if (repo) {
        if (repo.userId && repo.userId !== req.user.id) {
          throw new AppError('Unauthorized: You do not have access to this repository.', 403);
        }
        resolvedFullName = repo.fullName || repo.name;
      }
    }

    // Try to fetch contents from GitHub if connected
    try {
      const contents = await githubService.getRepositoryContents(
        req.user.id,
        resolvedFullName,
        '',
        targetBranch
      );

      for (const item of contents.items) {
        let content: string | undefined = undefined;
        // Fetch content for key manifests
        const isKeyManifest = [
          'package.json',
          'pom.xml',
          'requirements.txt',
          'pyproject.toml',
          'composer.json',
          'Dockerfile',
          'docker-compose.yml',
          'docker-compose.yaml',
          'compose.yaml',
          'tsconfig.json',
        ].includes(item.name);

        if (item.type === 'file' && isKeyManifest) {
          try {
            const fileData = await githubService.getRepositoryFile(
              req.user.id,
              resolvedFullName,
              item.path,
              targetBranch
            );
            content = fileData.content;
          } catch {
            // Ignore individual file retrieval errors
          }
        }

        projectFiles.push({
          path: item.path,
          type: item.type === 'directory' ? 'dir' : 'file',
          content,
        });
      }
    } catch (err) {
      // If GitHub contents fail (e.g. mock/test repo or network issue), provide sensible fallback
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('Unauthorized') || errorMsg.includes('403')) {
        throw new AppError('Unauthorized: You do not have permission to access this repository.', 403);
      }
    }

    const analysis = analyzeProjectFiles(projectFiles);

    res.status(200).json({
      success: true,
      data: {
        repoFullName: resolvedFullName,
        branch: targetBranch,
        analysis,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Generates Dockerfile, .dockerignore, and optional Docker Compose from stack analysis.
 */
export function generateConfiguration(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }

    const { stack } = req.body;
    if (!stack || typeof stack !== 'object') {
      throw new AppError('A valid stack analysis object is required.', 400);
    }

    const config = generateDockerConfig(stack);

    res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Creates and queues a new Docker build job.
 */
export async function createBuild(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }

    const {
      repositoryId,
      repoFullName,
      branch,
      imageTag,
      dockerfile,
      dockerignore,
      composeFile,
      detectedStack,
    } = req.body;

    if (!repoFullName || typeof repoFullName !== 'string') {
      throw new AppError('Repository full name (owner/repo) is required.', 400);
    }
    if (!imageTag || typeof imageTag !== 'string') {
      throw new AppError('Image tag (e.g. "service:v1") is required.', 400);
    }
    if (!dockerfile || typeof dockerfile !== 'string') {
      throw new AppError('Dockerfile content is required to start a build.', 400);
    }

    // Verify repository ownership if repositoryId is provided
    if (repositoryId) {
      const repo = await repoRepo.findRepositoryById(repositoryId);
      if (repo && repo.userId && repo.userId !== req.user.id) {
        throw new AppError('Unauthorized: You do not have permission to build this repository.', 403);
      }
    }

    const job = createBuildJob({
      userId: req.user.id,
      repositoryId,
      repoFullName,
      branch: branch || 'main',
      imageTag,
      dockerfile,
      dockerignore,
      composeFile,
      detectedStack,
    });

    res.status(201).json({
      success: true,
      data: job,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Returns status, metadata, and timing for a specific build job.
 */
export function getBuild(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }

    const { id } = req.params;
    const job = getBuildJobById(id, req.user.id);

    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Returns bounded sanitized logs for a specific build job.
 */
export function getBuildLogs(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }

    const { id } = req.params;
    const job = getBuildJobById(id, req.user.id);

    const sinceParam = req.query.since ? parseInt(req.query.since as string, 10) : 0;
    const logs = isNaN(sinceParam) || sinceParam <= 0 ? job.logs : job.logs.slice(sinceParam);

    res.status(200).json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        logs,
        totalLogs: job.logs.length,
        durationMs: job.durationMs,
        imageId: job.imageId,
        imageSize: job.imageSize,
        errorDetails: job.errorDetails,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Lists previous Docker build jobs for the authenticated user.
 */
export function listBuilds(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }

    const jobs = listUserBuildJobs(req.user.id);

    res.status(200).json({
      success: true,
      data: jobs,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Cancels a queued or building job.
 */
export function cancelBuild(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }

    const { id } = req.params;
    const job = cancelBuildJob(id, req.user.id);

    res.status(200).json({
      success: true,
      data: job,
      message: 'Build job cancelled successfully.',
    });
  } catch (error) {
    next(error);
  }
}
