import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authenticate.js';
import * as githubService from '../services/githubService.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { createRepositorySchema } from '../schemas/repositorySchema.js';

export async function initiateConnect(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required to connect GitHub', 401);
    }
    const url = githubService.buildAuthorizationUrl(req.user.id);
    res.status(200).json({
      success: true,
      data: { url },
    });
  } catch (error) {
    next(error);
  }
}

export async function handleCallback(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  const { code, state } = req.query;

  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    return res.redirect(`${env.FRONTEND_URL}/repositories?github=error`);
  }

  try {
    await githubService.handleOAuthCallback(code, state);
    res.redirect(`${env.FRONTEND_URL}/repositories?github=connected`);
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    res.redirect(`${env.FRONTEND_URL}/repositories?github=error`);
  }
}

export async function getGithubStatus(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const status = await githubService.getConnectionStatus(req.user?.id);
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
}

export async function getGithubRepositories(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const page = parseInt((req.query.page as string) || '1', 10);
    const perPage = parseInt((req.query.perPage as string) || '20', 10);

    const repos = await githubService.getRepositories(req.user.id, page, perPage);

    res.status(200).json({
      success: true,
      data: repos,
    });
  } catch (error) {
    next(error);
  }
}

export async function getGithubRepositoryById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const { id } = req.params;
    const repo = await githubService.getRepositoryById(req.user.id, id);

    res.status(200).json({
      success: true,
      data: repo,
    });
  } catch (error) {
    next(error);
  }
}

export async function getGithubRepositoryBranches(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const { id } = req.params;
    const branches = await githubService.getRepositoryBranches(req.user.id, id);

    res.status(200).json({
      success: true,
      data: branches,
    });
  } catch (error) {
    next(error);
  }
}

export async function getGithubRepositoryCommits(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const { id } = req.params;
    const commits = await githubService.getRepositoryCommits(req.user.id, id);

    res.status(200).json({
      success: true,
      data: commits,
    });
  } catch (error) {
    next(error);
  }
}

export async function getGithubRepositoryPullRequests(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const { id } = req.params;
    const pullRequests = await githubService.getRepositoryPullRequests(req.user.id, id);

    res.status(200).json({
      success: true,
      data: pullRequests,
    });
  } catch (error) {
    next(error);
  }
}

export async function disconnectGithub(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    await githubService.disconnectGithub(req.user.id);

    res.status(200).json({
      success: true,
      message: 'GitHub disconnected successfully.',
    });
  } catch (error) {
    next(error);
  }
}

export async function getGithubRepositoryContents(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const { id } = req.params;
    const path = (req.query.path as string) || '';
    const branch = req.query.branch as string | undefined;

    const result = await githubService.getRepositoryContents(req.user.id, id, path, branch);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getGithubRepositoryFile(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const { id } = req.params;
    const path = req.query.path as string;
    const branch = req.query.branch as string | undefined;

    if (!path) {
      throw new AppError('Query parameter "path" is required', 400);
    }

    const result = await githubService.getRepositoryFile(req.user.id, id, path, branch);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateGithubRepositoryFile(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const { id } = req.params;
    const { path, branch, content, sha, commitMessage } = req.body;

    const result = await githubService.updateRepositoryFile(req.user.id, id, {
      path,
      branch,
      content,
      sha,
      commitMessage,
    });

    res.status(200).json({
      success: true,
      data: result,
      message: 'File committed successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function createGithubRepository(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const validatedData = createRepositorySchema.parse(req.body);
    const result = await githubService.createRepository(req.user.id, validatedData);

    res.status(201).json({
      success: true,
      data: result,
      message: 'Repository created successfully',
    });
  } catch (error) {
    next(error);
  }
}


