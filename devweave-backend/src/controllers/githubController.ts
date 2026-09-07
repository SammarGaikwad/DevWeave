import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authenticate.js';
import * as githubService from '../services/githubService.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { createRepositorySchema, bulkUploadFilesSchema } from '../schemas/repositorySchema.js';

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

const SENSITIVE_FILE_REGEX = /(^\.?env($|\.)|^\.git($|\/)|node_modules|\.DS_Store$|\.(key|pem|crt)$)/i;

function isPathSafe(filePath: string): boolean {
  if (!filePath || filePath.trim().length === 0) return false;
  if (filePath.includes('\\')) return false;
  if (filePath.startsWith('/') || /^[a-zA-Z]:/.test(filePath)) return false;
  const segments = filePath.split('/');
  if (segments.some((seg) => seg === '.' || seg === '..')) return false;
  const fileName = segments[segments.length - 1];
  if (SENSITIVE_FILE_REGEX.test(fileName)) return false;
  return true;
}

export async function bulkUploadGithubRepositoryFiles(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const { id } = req.params;

    // Temporary Debug Logging (Step 7)
    console.log('[UPLOAD DEBUG]', {
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
    });

    const multerFiles = (req.files as Express.Multer.File[]) || [];
    console.log('[UPLOAD DEBUG CONTROLLER]', {
      filesReceived: multerFiles.length,
      bodyKeys: Object.keys(req.body || {}),
    });

    // Case 1: Multipart / Form-Data Upload (Primary Flow)
    if (multerFiles.length > 0) {
      const branch = req.body.branch ? String(req.body.branch).trim() : undefined;
      const commitMessage = req.body.commitMessage || req.body.message || 'Upload files via DevWeave';

      if (!commitMessage || typeof commitMessage !== 'string' || !commitMessage.trim()) {
        throw new AppError('Commit message is required', 400);
      }

      let rawPaths: string[] = [];
      if (Array.isArray(req.body.paths)) {
        rawPaths = req.body.paths.map(String);
      } else if (typeof req.body.paths === 'string') {
        try {
          const parsed = JSON.parse(req.body.paths);
          rawPaths = Array.isArray(parsed) ? parsed.map(String) : [req.body.paths];
        } catch {
          rawPaths = [req.body.paths];
        }
      }

      if (multerFiles.length > 100) {
        throw new AppError('Cannot upload more than 100 files at once', 400);
      }

      const totalSize = multerFiles.reduce((acc, f) => acc + f.size, 0);
      if (totalSize > 20 * 1024 * 1024) {
        throw new AppError('Total upload size exceeds the allowed limit of 20 MB', 400);
      }

      const fileItems: githubService.BufferUploadFileItem[] = [];
      for (let i = 0; i < multerFiles.length; i++) {
        const file = multerFiles[i];
        const rawPath = rawPaths[i] || file.originalname;
        const normalizedPath = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');

        if (!isPathSafe(normalizedPath)) {
          throw new AppError(
            `Forbidden or unsafe file path: "${normalizedPath}". Path traversal, absolute paths, and sensitive files (.env, .git, .key, .pem) are disallowed.`,
            400
          );
        }

        if (file.size > 5 * 1024 * 1024) {
          throw new AppError(`File "${normalizedPath}" exceeds the 5 MB per-file limit.`, 400);
        }

        fileItems.push({
          path: normalizedPath,
          buffer: file.buffer,
        });
      }

      const result = await githubService.bulkUploadFilesFromBuffers(req.user.id, id, {
        branch,
        message: commitMessage.trim(),
        files: fileItems,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: `${result.committedFilesCount} file(s) committed successfully`,
      });
      return;
    }

    // Case 2: JSON Payload Fallback
    const validatedData = bulkUploadFilesSchema.parse(req.body);
    const result = await githubService.bulkUploadFiles(req.user.id, id, validatedData);

    res.status(200).json({
      success: true,
      data: result,
      message: `${result.committedFilesCount} file(s) committed successfully`,
    });
  } catch (error) {
    next(error);
  }
}


