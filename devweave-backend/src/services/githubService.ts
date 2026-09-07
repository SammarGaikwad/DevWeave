import crypto from 'crypto';
import { Repository, RepositoryProvider, RepositoryVisibility } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
import { encryptToken, decryptToken } from '../utils/encryption.js';

import * as githubClient from '../clients/githubClient.js';
import * as githubRepo from '../repositories/githubIntegrationRepository.js';
import {
  GithubStatusResponse,
  RepositoryResponse,
  BranchResponse,
  CommitResponse,
  PullRequestResponse,
  GithubContentsResponse,
  GithubFileResponse,
  CommitFileRequest,
  CommitFileResponse,
  GithubContentItem,
  CreateRepositoryResponse,
  BulkUploadFilesResponse,
} from '../types/index.js';
import { CreateRepositoryInput, BulkUploadFilesInput } from '../schemas/repositorySchema.js';
import { AppError } from '../middleware/errorHandler.js';

interface OAuthStateRecord {
  userId: string;
  expiresAt: number;
}

const oauthStateStore = new Map<string, OAuthStateRecord>();

// Periodic cleanup for expired OAuth state tokens
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    const now = Date.now();
    for (const [hashedState, record] of oauthStateStore.entries()) {
      if (now > record.expiresAt) {
        oauthStateStore.delete(hashedState);
      }
    }
  }, 5 * 60 * 1000).unref();
}

function hashStateToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createOAuthState(userId: string): string {
  const randomToken = crypto.randomBytes(32).toString('hex');
  const stateToken = `devweave_state_${randomToken}`;
  const hashedState = hashStateToken(stateToken);
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minute TTL

  oauthStateStore.set(hashedState, { userId, expiresAt });
  return stateToken;
}

export function verifyState(stateToken: string): string {
  if (!stateToken) {
    throw new AppError('OAuth state missing or invalid', 400);
  }

  const hashedState = hashStateToken(stateToken);
  const record = oauthStateStore.get(hashedState);

  if (!record) {
    throw new AppError('Invalid or expired OAuth state', 400);
  }

  // Single-use: immediately delete state token to prevent state reuse / replay attacks
  oauthStateStore.delete(hashedState);

  if (Date.now() > record.expiresAt) {
    throw new AppError('OAuth state expired', 400);
  }

  return record.userId;
}

export function clearOAuthStateStore(): void {
  oauthStateStore.clear();
}

export function buildAuthorizationUrl(userId: string): string {
  const state = createOAuthState(userId);
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: env.GITHUB_CALLBACK_URL,
    scope: 'read:user repo',
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function handleOAuthCallback(code: string, state: string): Promise<string> {
  const userId = verifyState(state);

  const rawAccessToken = await githubClient.exchangeOAuthCode(code);
  const githubUser = await githubClient.getAuthenticatedUser(rawAccessToken);

  const encryptedAccessToken = encryptToken(rawAccessToken);

  try {
    await prisma.githubIntegration.upsert({
      where: { userId },
      update: {
        githubUserId: String(githubUser.id),
        githubUsername: githubUser.login,
        githubAvatarUrl: githubUser.avatar_url,
        encryptedAccessToken,
      },
      create: {
        userId,
        githubUserId: String(githubUser.id),
        githubUsername: githubUser.login,
        githubAvatarUrl: githubUser.avatar_url,
        encryptedAccessToken,
      },
    });
  } catch {
    console.warn('⚠️ Notice: Database lookup failed or PostgreSQL is offline.');
  }

  return userId;
}

export async function getConnectionStatus(userId?: string): Promise<GithubStatusResponse> {
  if (!userId) {
    return { connected: false };
  }

  try {
    const integration = await githubRepo.findGithubIntegrationByUserId(userId);
    if (!integration) {
      return { connected: false };
    }

    return {
      connected: true,
      username: integration.githubUsername,
      avatarUrl: integration.githubAvatarUrl || undefined,
      createdAt: integration.createdAt,
    };
  } catch (error) {
    console.warn('⚠️ Notice: Database lookup failed or PostgreSQL is offline.');
    return { connected: false };
  }
}

async function getDecryptedAccessTokenForUser(userId: string): Promise<string> {
  try {
    const integration = await githubRepo.findGithubIntegrationByUserId(userId);
    if (!integration || !integration.encryptedAccessToken) {
      throw new AppError('GitHub account is not connected.', 409);
    }
    return decryptToken(integration.encryptedAccessToken);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('GitHub account is not connected.', 409);
  }
}

export async function getRepositories(
  userId: string,
  page = 1,
  perPage = 20
): Promise<RepositoryResponse[]> {
  const accessToken = await getDecryptedAccessTokenForUser(userId);
  const rawRepos = await githubClient.fetchUserRepositories(accessToken, page, perPage);

  const normalizedRepos: RepositoryResponse[] = [];

  for (const raw of rawRepos) {
    const visibility = raw.private ? RepositoryVisibility.PRIVATE : RepositoryVisibility.PUBLIC;
    const now = new Date();

    let dbRepo: Repository = {
      id: `github-${raw.id}`,
      externalId: String(raw.id),
      name: raw.name,
      fullName: raw.full_name,
      description: raw.description,
      owner: raw.owner.login,
      visibility,
      language: raw.language,
      defaultBranch: raw.default_branch,
      stars: raw.stargazers_count,
      forks: raw.forks_count,
      archived: raw.archived,
      sourceProvider: RepositoryProvider.GITHUB,
      userId,
      createdAt: now,
      updatedAt: now,
    };

    try {
      dbRepo = await prisma.repository.upsert({
        where: { id: `github-${raw.id}` },
        update: {
          externalId: String(raw.id),
          name: raw.name,
          fullName: raw.full_name,
          description: raw.description,
          owner: raw.owner.login,
          visibility,
          language: raw.language,
          defaultBranch: raw.default_branch,
          stars: raw.stargazers_count,
          forks: raw.forks_count,
          archived: raw.archived,
          sourceProvider: RepositoryProvider.GITHUB,
          userId,
        },
        create: {
          id: `github-${raw.id}`,
          externalId: String(raw.id),
          name: raw.name,
          fullName: raw.full_name,
          description: raw.description,
          owner: raw.owner.login,
          visibility,
          language: raw.language,
          defaultBranch: raw.default_branch,
          stars: raw.stargazers_count,
          forks: raw.forks_count,
          archived: raw.archived,
          sourceProvider: RepositoryProvider.GITHUB,
          userId,
        },
      });
    } catch {
      // PostgreSQL is offline, proceed with normalized object
    }

    normalizedRepos.push({
      id: dbRepo.id,
      externalId: dbRepo.externalId,
      name: dbRepo.name,
      fullName: dbRepo.fullName,
      description: dbRepo.description,
      owner: dbRepo.owner,
      visibility: dbRepo.visibility,
      language: dbRepo.language,
      defaultBranch: dbRepo.defaultBranch,
      stars: dbRepo.stars,
      forks: dbRepo.forks,
      archived: dbRepo.archived,
      sourceProvider: dbRepo.sourceProvider,
      createdAt: dbRepo.createdAt,
      updatedAt: dbRepo.updatedAt,
    });
  }

  return normalizedRepos;
}

export async function getRepositoryById(
  userId: string,
  repoId: string
): Promise<RepositoryResponse> {
  let dbRepo = null;
  try {
    dbRepo = await prisma.repository.findFirst({
      where: {
        OR: [{ id: repoId }, { externalId: repoId }],
        userId,
      },
    });
  } catch {
    // Database offline
  }

  if (dbRepo) {
    return {
      id: dbRepo.id,
      externalId: dbRepo.externalId,
      name: dbRepo.name,
      fullName: dbRepo.fullName,
      description: dbRepo.description,
      owner: dbRepo.owner,
      visibility: dbRepo.visibility,
      language: dbRepo.language,
      defaultBranch: dbRepo.defaultBranch,
      stars: dbRepo.stars,
      forks: dbRepo.forks,
      archived: dbRepo.archived,
      sourceProvider: dbRepo.sourceProvider,
      createdAt: dbRepo.createdAt,
      updatedAt: dbRepo.updatedAt,
    };
  }

  // Fallback: If DB record is not found or DB is offline, fetch user repos directly from GitHub API
  try {
    const userRepos = await getRepositories(userId, 1, 100);
    const matched = userRepos.find(
      (r) =>
        r.id === repoId ||
        r.externalId === repoId ||
        r.name.toLowerCase() === repoId.toLowerCase() ||
        r.fullName?.toLowerCase() === repoId.toLowerCase()
    );

    if (matched) {
      return matched;
    }
  } catch {
    // If fetching user repos failed, continue to 404 throw
  }

  throw new AppError(`Repository not found with ID: ${repoId}`, 404);
}

export async function getRepositoryBranches(
  userId: string,
  repoId: string
): Promise<BranchResponse[]> {
  const repo = await getRepositoryById(userId, repoId);
  const accessToken = await getDecryptedAccessTokenForUser(userId);

  const owner = repo.owner || repo.fullName?.split('/')[0] || '';
  const rawBranches = await githubClient.fetchRepositoryBranches(accessToken, owner, repo.name);

  return rawBranches.map((b) => ({
    name: b.name,
    protected: b.protected,
    commitSha: b.commit.sha,
  }));
}

export async function getRepositoryCommits(
  userId: string,
  repoId: string
): Promise<CommitResponse[]> {
  const repo = await getRepositoryById(userId, repoId);
  const accessToken = await getDecryptedAccessTokenForUser(userId);

  const owner = repo.owner || repo.fullName?.split('/')[0] || '';
  const rawCommits = await githubClient.fetchRepositoryCommits(accessToken, owner, repo.name);

  return rawCommits.map((c) => ({
    sha: c.sha,
    message: c.commit.message,
    author: c.commit.author.name,
    timestamp: c.commit.author.date,
  }));
}

export async function getRepositoryPullRequests(
  userId: string,
  repoId: string
): Promise<PullRequestResponse[]> {
  const repo = await getRepositoryById(userId, repoId);
  const accessToken = await getDecryptedAccessTokenForUser(userId);

  const owner = repo.owner || repo.fullName?.split('/')[0] || '';
  const rawPulls = await githubClient.fetchRepositoryPullRequests(accessToken, owner, repo.name);

  return rawPulls.map((p) => {
    let state: 'OPEN' | 'CLOSED' | 'MERGED' = 'OPEN';
    if (p.merged_at) {
      state = 'MERGED';
    } else if (p.state === 'closed') {
      state = 'CLOSED';
    }

    return {
      number: p.number,
      title: p.title,
      author: p.user.login,
      state,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    };
  });
}

export async function disconnectGithub(userId: string): Promise<boolean> {
  return githubRepo.deleteGithubIntegrationByUserId(userId);
}

export async function getRepositoryContents(
  userId: string,
  repoId: string,
  path = '',
  branch?: string
): Promise<GithubContentsResponse> {
  const repo = await getRepositoryById(userId, repoId);
  const accessToken = await getDecryptedAccessTokenForUser(userId);

  const owner = repo.owner || repo.fullName?.split('/')[0] || '';
  const rawItems = await githubClient.fetchRepositoryContents(
    accessToken,
    owner,
    repo.name,
    path,
    branch
  );

  const items: GithubContentItem[] = rawItems.map((item) => ({
    name: item.name,
    path: item.path,
    type: item.type === 'dir' ? 'directory' : 'file',
    size: item.size,
    sha: item.sha,
  }));

  // Sort directories first, then files alphabetically
  items.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return {
    path,
    branch: branch || repo.defaultBranch || 'main',
    items,
  };
}

export async function getRepositoryFile(
  userId: string,
  repoId: string,
  path: string,
  branch?: string
): Promise<GithubFileResponse> {
  if (!path) {
    throw new AppError('File path parameter is required', 400);
  }

  const repo = await getRepositoryById(userId, repoId);
  const accessToken = await getDecryptedAccessTokenForUser(userId);

  const owner = repo.owner || repo.fullName?.split('/')[0] || '';
  const rawFile = await githubClient.fetchRepositoryFileContent(
    accessToken,
    owner,
    repo.name,
    path,
    branch
  );

  let decodedContent = '';
  if (rawFile.content) {
    const cleanedBase64 = rawFile.content.replace(/\s/g, '');
    decodedContent = Buffer.from(cleanedBase64, 'base64').toString('utf-8');
  }

  return {
    name: rawFile.name,
    path: rawFile.path,
    sha: rawFile.sha,
    branch: branch || repo.defaultBranch || 'main',
    size: rawFile.size,
    content: decodedContent,
  };
}

export async function updateRepositoryFile(
  userId: string,
  repoId: string,
  data: CommitFileRequest
): Promise<CommitFileResponse> {
  if (!data.path || typeof data.path !== 'string') {
    throw new AppError('File path is required', 400);
  }
  if (!data.branch || typeof data.branch !== 'string') {
    throw new AppError('Branch is required', 400);
  }
  if (!data.commitMessage || typeof data.commitMessage !== 'string' || !data.commitMessage.trim()) {
    throw new AppError('Commit message is required', 400);
  }
  if (typeof data.content !== 'string') {
    throw new AppError('File content must be a string', 400);
  }
  if (!data.sha || typeof data.sha !== 'string') {
    throw new AppError('Existing file SHA is required for update', 400);
  }

  const repo = await getRepositoryById(userId, repoId);
  const accessToken = await getDecryptedAccessTokenForUser(userId);

  const owner = repo.owner || repo.fullName?.split('/')[0] || '';
  const base64Content = Buffer.from(data.content, 'utf-8').toString('base64');

  const result = await githubClient.updateRepositoryFileContent(
    accessToken,
    owner,
    repo.name,
    data.path,
    {
      message: data.commitMessage,
      content: base64Content,
      branch: data.branch,
      sha: data.sha,
    }
  );

  return {
    path: data.path,
    commit: {
      sha: result.commit.sha,
      message: result.commit.message,
    },
  };
}

export async function createRepository(
  userId: string,
  data: CreateRepositoryInput
): Promise<CreateRepositoryResponse> {
  const accessToken = await getDecryptedAccessTokenForUser(userId);

  // Call GitHub REST API to create repository
  let rawRepo;
  try {
    rawRepo = await githubClient.createUserRepository(accessToken, {
      name: data.name,
      description: data.description,
      private: data.private,
      initializeReadme: data.initializeReadme,
    });
  } catch (error: unknown) {
    const appErr = error as AppError;
    if (appErr.statusCode === 422 || appErr.message?.includes('already exists')) {
      throw new AppError('A repository with this name already exists.', 409);
    }
    throw error;
  }

  const visibility = rawRepo.private ? RepositoryVisibility.PRIVATE : RepositoryVisibility.PUBLIC;
  const now = new Date();

  let dbRepo: Repository = {
    id: `github-${rawRepo.id}`,
    externalId: String(rawRepo.id),
    name: rawRepo.name,
    fullName: rawRepo.full_name,
    description: rawRepo.description,
    owner: rawRepo.owner.login,
    visibility,
    language: rawRepo.language,
    defaultBranch: rawRepo.default_branch || 'main',
    stars: rawRepo.stargazers_count || 0,
    forks: rawRepo.forks_count || 0,
    archived: rawRepo.archived || false,
    sourceProvider: RepositoryProvider.GITHUB,
    userId,
    createdAt: now,
    updatedAt: now,
  };

  // Synchronize created repository into PostgreSQL database
  try {
    dbRepo = await prisma.repository.upsert({
      where: { id: `github-${rawRepo.id}` },
      update: {
        externalId: String(rawRepo.id),
        name: rawRepo.name,
        fullName: rawRepo.full_name,
        description: rawRepo.description,
        owner: rawRepo.owner.login,
        visibility,
        language: rawRepo.language,
        defaultBranch: rawRepo.default_branch || 'main',
        stars: rawRepo.stargazers_count || 0,
        forks: rawRepo.forks_count || 0,
        archived: rawRepo.archived || false,
        sourceProvider: RepositoryProvider.GITHUB,
        userId,
      },
      create: {
        id: `github-${rawRepo.id}`,
        externalId: String(rawRepo.id),
        name: rawRepo.name,
        fullName: rawRepo.full_name,
        description: rawRepo.description,
        owner: rawRepo.owner.login,
        visibility,
        language: rawRepo.language,
        defaultBranch: rawRepo.default_branch || 'main',
        stars: rawRepo.stargazers_count || 0,
        forks: rawRepo.forks_count || 0,
        archived: rawRepo.archived || false,
        sourceProvider: RepositoryProvider.GITHUB,
        userId,
      },
    });
  } catch (dbError) {
    console.warn('⚠️ Notice: Repository created on GitHub, but PostgreSQL insertion failed or DB is offline:', dbError);
  }

  return {
    repository: {
      id: dbRepo.id,
      name: dbRepo.name,
      fullName: dbRepo.fullName || `${rawRepo.owner.login}/${rawRepo.name}`,
      description: dbRepo.description,
      private: rawRepo.private,
      defaultBranch: dbRepo.defaultBranch || 'main',
      htmlUrl: `https://github.com/${rawRepo.owner.login}/${rawRepo.name}`,
      cloneUrl: `https://github.com/${rawRepo.owner.login}/${rawRepo.name}.git`,
    },
  };
}

export async function bulkUploadFiles(
  userId: string,
  repoId: string,
  data: BulkUploadFilesInput
): Promise<BulkUploadFilesResponse> {
  const repo = await getRepositoryById(userId, repoId);
  const accessToken = await getDecryptedAccessTokenForUser(userId);
  const owner = repo.owner || repo.fullName?.split('/')[0] || '';
  const branchName = data.branch || repo.defaultBranch || 'main';

  // 1. Create Blobs for each file
  const treeItems: githubClient.RawGitTreeItem[] = [];
  for (const file of data.files) {
    const blob = await githubClient.createGitBlob(
      accessToken,
      owner,
      repo.name,
      file.content,
      file.encoding as 'utf-8' | 'base64'
    );
    treeItems.push({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blob.sha,
    });
  }

  // 2. Fetch current ref to check if branch exists
  let latestCommitSha: string | null = null;
  let baseTreeSha: string | undefined = undefined;

  try {
    const gitRef = await githubClient.fetchGitRef(accessToken, owner, repo.name, branchName);
    latestCommitSha = gitRef.object.sha;
    const commit = await githubClient.fetchGitCommit(accessToken, owner, repo.name, latestCommitSha);
    baseTreeSha = commit.tree.sha;
  } catch {
    latestCommitSha = null;
    baseTreeSha = undefined;
  }

  // 3. Create Tree
  const newTree = await githubClient.createGitTree(
    accessToken,
    owner,
    repo.name,
    baseTreeSha || '',
    treeItems
  );

  // 4. Create Commit
  const parents = latestCommitSha ? [latestCommitSha] : [];
  const newCommit = await githubClient.createGitCommit(
    accessToken,
    owner,
    repo.name,
    data.message,
    newTree.sha,
    parents
  );

  // 5. Update or Create Ref
  if (latestCommitSha) {
    await githubClient.updateGitRef(accessToken, owner, repo.name, branchName, newCommit.sha);
  } else {
    try {
      await githubClient.updateGitRef(accessToken, owner, repo.name, branchName, newCommit.sha);
    } catch {
      await githubClient.createGitRef(accessToken, owner, repo.name, branchName, newCommit.sha);
    }
  }

  return {
    success: true,
    branch: branchName,
    commitSha: newCommit.sha,
    committedFilesCount: data.files.length,
    files: data.files.map((f) => ({ path: f.path })),
  };
}

export interface BufferUploadFileItem {
  path: string;
  buffer: Buffer;
}

export async function bulkUploadFilesFromBuffers(
  userId: string,
  repoId: string,
  data: {
    branch?: string;
    message: string;
    files: BufferUploadFileItem[];
  }
): Promise<BulkUploadFilesResponse> {
  const repo = await getRepositoryById(userId, repoId);
  const accessToken = await getDecryptedAccessTokenForUser(userId);
  const owner = repo.owner || repo.fullName?.split('/')[0] || '';
  const branchName = data.branch || repo.defaultBranch || 'main';

  // 1. Create Blobs for each file using Base64 encoding from buffer
  const treeItems: githubClient.RawGitTreeItem[] = [];
  for (const file of data.files) {
    const base64Content = file.buffer.toString('base64');
    const blob = await githubClient.createGitBlob(
      accessToken,
      owner,
      repo.name,
      base64Content,
      'base64'
    );
    treeItems.push({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blob.sha,
    });
  }

  // 2. Fetch current ref to check if branch exists
  let latestCommitSha: string | null = null;
  let baseTreeSha: string | undefined = undefined;

  try {
    const gitRef = await githubClient.fetchGitRef(accessToken, owner, repo.name, branchName);
    latestCommitSha = gitRef.object.sha;
    const commit = await githubClient.fetchGitCommit(accessToken, owner, repo.name, latestCommitSha);
    baseTreeSha = commit.tree.sha;
  } catch {
    latestCommitSha = null;
    baseTreeSha = undefined;
  }

  // 3. Create Tree
  const newTree = await githubClient.createGitTree(
    accessToken,
    owner,
    repo.name,
    baseTreeSha || '',
    treeItems
  );

  // 4. Create Commit
  const parents = latestCommitSha ? [latestCommitSha] : [];
  const newCommit = await githubClient.createGitCommit(
    accessToken,
    owner,
    repo.name,
    data.message,
    newTree.sha,
    parents
  );

  // 5. Update or Create Ref
  if (latestCommitSha) {
    await githubClient.updateGitRef(accessToken, owner, repo.name, branchName, newCommit.sha);
  } else {
    try {
      await githubClient.updateGitRef(accessToken, owner, repo.name, branchName, newCommit.sha);
    } catch {
      await githubClient.createGitRef(accessToken, owner, repo.name, branchName, newCommit.sha);
    }
  }

  return {
    success: true,
    branch: branchName,
    commitSha: newCommit.sha,
    committedFilesCount: data.files.length,
    files: data.files.map((f) => ({ path: f.path })),
  };
}


