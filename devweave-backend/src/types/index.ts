import type { Role, RepositoryVisibility, RepositoryProvider } from '../generated/prisma/client.js';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  environment: string;
  timestamp: string;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export interface RepositoryResponse {
  id: string;
  externalId?: string | null;
  name: string;
  fullName?: string | null;
  description?: string | null;
  owner?: string | null;
  visibility: RepositoryVisibility;
  language?: string | null;
  defaultBranch?: string | null;
  stars: number;
  forks: number;
  archived: boolean;
  sourceProvider: RepositoryProvider;
  createdAt: Date;
  updatedAt: Date;
}

export interface GithubStatusResponse {
  connected: boolean;
  username?: string;
  avatarUrl?: string;
  createdAt?: Date;
}

export interface BranchResponse {
  name: string;
  protected: boolean;
  commitSha: string;
}

export interface CommitResponse {
  sha: string;
  message: string;
  author: string;
  timestamp: string;
}

export interface PullRequestResponse {
  number: number;
  title: string;
  author: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  createdAt: string;
  updatedAt: string;
}

export interface ErrorResponse {
  success: false;
  message: string;
  errors?: string[];
}

export interface GithubContentItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  sha?: string;
}

export interface GithubContentsResponse {
  path: string;
  branch: string;
  items: GithubContentItem[];
}

export interface GithubFileResponse {
  name: string;
  path: string;
  sha: string;
  branch: string;
  size?: number;
  content: string;
}

export interface CommitFileRequest {
  path: string;
  branch: string;
  content: string;
  sha: string;
  commitMessage: string;
}

export interface CommitFileResponse {
  path: string;
  commit: {
    sha: string;
    message: string;
  };
}

export interface CreateRepositoryData {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
  htmlUrl?: string;
  cloneUrl?: string;
}

export interface CreateRepositoryResponse {
  repository: CreateRepositoryData;
}

export interface BulkUploadFilesResponse {
  success: boolean;
  branch: string;
  commitSha: string;
  committedFilesCount: number;
  files: Array<{ path: string }>;
}

export interface JenkinsTriggerBuildResponse {
  message: string;
  queueItemUrl?: string;
  queueItemId?: number | null;
  buildUrl: string;
}

export interface JenkinsPipelineStage {
  id: string;
  name: string;
  status: 'SUCCESS' | 'IN_PROGRESS' | 'FAILED' | 'PAUSED' | 'ABORTED' | 'PENDING';
  durationMillis: number;
}

export interface JenkinsBuildDetailsResponse {
  id: number;
  number: number;
  status: 'SUCCESS' | 'FAILURE' | 'BUILDING' | 'NOT_BUILT' | 'ABORTED' | 'UNSTABLE' | 'UNKNOWN';
  result: string | null;
  duration: number;
  timestamp: number;
  url: string;
  commitMessage?: string;
  author?: string;
  stages?: JenkinsPipelineStage[];
}



