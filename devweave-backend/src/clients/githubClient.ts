import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_OAUTH_TOKEN_URL = 'https://github.com/login/oauth/access_token';

interface RawGithubUser {
  id: number;
  login: string;
  avatar_url: string;
}

export interface RawGithubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  language: string | null;
  default_branch: string;
  stargazers_count: number;
  forks_count: number;
  archived: boolean;
  owner: {
    login: string;
  };
}

export interface RawGithubBranch {
  name: string;
  protected: boolean;
  commit: {
    sha: string;
  };
}

export interface RawGithubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
}

export interface RawGithubPullRequest {
  number: number;
  title: string;
  state: string;
  merged_at: string | null;
  user: {
    login: string;
  };
  created_at: string;
  updated_at: string;
}

export interface RawGithubContentItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  html_url?: string;
  download_url?: string | null;
}

export interface RawGithubFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  encoding?: string;
  content?: string;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
}

export interface RawGithubCommitResponse {
  content: RawGithubContentItem | null;
  commit: {
    sha: string;
    message: string;
    html_url?: string;
  };
}

export async function exchangeOAuthCode(code: string): Promise<string> {
  try {
    const res = await fetch(GITHUB_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: env.GITHUB_CALLBACK_URL,
      }),
    });

    if (!res.ok) {
      throw new AppError('Failed to exchange authorization code with GitHub', 400);
    }

    const data = (await res.json()) as { access_token?: string; error_description?: string };

    if (!data.access_token) {
      throw new AppError(
        data.error_description || 'GitHub OAuth token exchange failed',
        400
      );
    }

    return data.access_token;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Unable to contact GitHub OAuth server', 502);
  }
}

async function githubFetch<T>(
  endpoint: string,
  accessToken: string,
  options?: RequestInit
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${GITHUB_API_BASE}${endpoint}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'DevWeave-Platform',
        ...(options?.headers || {}),
      },
    });

    if (res.status === 401) {
      throw new AppError('Your GitHub connection needs to be renewed.', 401);
    }

    if (res.status === 403) {
      throw new AppError('Insufficient GitHub permissions or rate limit reached.', 403);
    }

    if (res.status === 429) {
      const resetTime = res.headers.get('x-ratelimit-reset');
      let msg = 'GitHub request limit reached. Please try again later.';
      if (resetTime) {
        const date = new Date(parseInt(resetTime, 10) * 1000);
        msg += ` Reset at ${date.toLocaleTimeString()}.`;
      }
      throw new AppError(msg, 429);
    }

    if (res.status === 404) {
      throw new AppError('Requested GitHub resource not found.', 404);
    }

    if (res.status === 409) {
      throw new AppError('File changed on GitHub. Please reload the file before committing.', 409);
    }

    if (res.status === 422) {
      const errorData = (await res.json().catch(() => ({}))) as { message?: string };
      throw new AppError(errorData.message || 'Invalid GitHub request parameters.', 422);
    }

    if (!res.ok) {
      throw new AppError(`GitHub API error: ${res.statusText}`, res.status);
    }

    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Unable to communicate with GitHub API server.', 502);
  }
}

export async function getAuthenticatedUser(accessToken: string): Promise<RawGithubUser> {
  return githubFetch<RawGithubUser>('/user', accessToken);
}

export async function fetchUserRepositories(
  accessToken: string,
  page = 1,
  perPage = 20
): Promise<RawGithubRepo[]> {
  const safePerPage = Math.min(Math.max(perPage, 1), 100);
  return githubFetch<RawGithubRepo[]>(
    `/user/repos?sort=updated&direction=desc&page=${page}&per_page=${safePerPage}`,
    accessToken
  );
}

export async function fetchRepositoryDetails(
  accessToken: string,
  owner: string,
  repo: string
): Promise<RawGithubRepo> {
  return githubFetch<RawGithubRepo>(`/repos/${owner}/${repo}`, accessToken);
}

export async function fetchRepositoryBranches(
  accessToken: string,
  owner: string,
  repo: string
): Promise<RawGithubBranch[]> {
  return githubFetch<RawGithubBranch[]>(`/repos/${owner}/${repo}/branches?per_page=50`, accessToken);
}

export async function fetchRepositoryCommits(
  accessToken: string,
  owner: string,
  repo: string
): Promise<RawGithubCommit[]> {
  return githubFetch<RawGithubCommit[]>(`/repos/${owner}/${repo}/commits?per_page=30`, accessToken);
}

export async function fetchRepositoryPullRequests(
  accessToken: string,
  owner: string,
  repo: string
): Promise<RawGithubPullRequest[]> {
  return githubFetch<RawGithubPullRequest[]>(
    `/repos/${owner}/${repo}/pulls?state=all&per_page=30`,
    accessToken
  );
}

export async function fetchRepositoryContents(
  accessToken: string,
  owner: string,
  repo: string,
  path = '',
  branch?: string
): Promise<RawGithubContentItem[]> {
  const cleanPath = path ? path.split('/').map(encodeURIComponent).join('/') : '';
  const query = branch ? `?ref=${encodeURIComponent(branch)}` : '';
  const endpoint = cleanPath
    ? `/repos/${owner}/${repo}/contents/${cleanPath}${query}`
    : `/repos/${owner}/${repo}/contents${query}`;

  const res = await githubFetch<RawGithubContentItem[] | RawGithubContentItem>(endpoint, accessToken);
  if (Array.isArray(res)) {
    return res;
  }
  return [res];
}

export async function fetchRepositoryFileContent(
  accessToken: string,
  owner: string,
  repo: string,
  path: string,
  branch?: string
): Promise<RawGithubFileContent> {
  const cleanPath = path.split('/').map(encodeURIComponent).join('/');
  const query = branch ? `?ref=${encodeURIComponent(branch)}` : '';
  const endpoint = `/repos/${owner}/${repo}/contents/${cleanPath}${query}`;

  return githubFetch<RawGithubFileContent>(endpoint, accessToken);
}

export async function updateRepositoryFileContent(
  accessToken: string,
  owner: string,
  repo: string,
  path: string,
  payload: {
    message: string;
    content: string;
    branch?: string;
    sha: string;
  }
): Promise<RawGithubCommitResponse> {
  const cleanPath = path.split('/').map(encodeURIComponent).join('/');
  const endpoint = `/repos/${owner}/${repo}/contents/${cleanPath}`;

  const body: Record<string, string> = {
    message: payload.message,
    content: payload.content,
    sha: payload.sha,
  };
  if (payload.branch) {
    body.branch = payload.branch;
  }

  return githubFetch<RawGithubCommitResponse>(endpoint, accessToken, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export interface RawGithubCreateRepoPayload {
  name: string;
  description?: string;
  private?: boolean;
  initializeReadme?: boolean;
}

export async function createUserRepository(
  accessToken: string,
  payload: RawGithubCreateRepoPayload
): Promise<RawGithubRepo> {
  const body = {
    name: payload.name,
    description: payload.description || undefined,
    private: Boolean(payload.private),
    auto_init: payload.initializeReadme !== false,
    has_issues: true,
    has_projects: true,
    has_wiki: true,
  };

  return githubFetch<RawGithubRepo>('/user/repos', accessToken, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}


