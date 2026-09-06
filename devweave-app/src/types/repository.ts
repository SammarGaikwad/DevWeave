import type { StatusType } from '../components/ui/StatusBadge';

export interface Repository {
  id: string;
  name: string;
  fullName?: string;
  description?: string;
  owner?: string;
  visibility: 'public' | 'private' | 'PUBLIC' | 'PRIVATE';
  language?: string;
  defaultBranch?: string;
  stars?: number;
  forks?: number;
  openIssues?: number;
  pullRequestsCount?: number;
  updatedAt?: string;
  status?: StatusType;
  archived?: boolean;
  source?: 'GitHub' | 'GitLab' | 'Bitbucket';
  pipelineStatus?: 'connected' | 'not_connected';
  latestDeployment?: {
    environment: string;
    status: 'successful' | 'failed' | 'running' | 'pending';
    updatedAt: string;
  };
}

export interface BranchInfo {
  name: string;
  lastCommit?: string;
  updatedAt?: string;
  isDefault?: boolean;
  protected?: boolean;
  commitSha?: string;
}

export interface CommitInfo {
  id?: string;
  sha?: string;
  message: string;
  author: string;
  timestamp?: string;
  hash?: string;
}

export interface PullRequestInfo {
  id?: string;
  number: number;
  title: string;
  status?: 'Open' | 'Merged' | 'Closed';
  state?: 'OPEN' | 'CLOSED' | 'MERGED';
  author: string;
  timestamp?: string;
  createdAt?: string;
  updatedAt?: string;
  branch?: string;
}

export interface GithubContentItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  sha?: string;
}

export interface GithubContentsData {
  path: string;
  branch: string;
  items: GithubContentItem[];
}

export interface GithubFile {
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

