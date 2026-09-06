import { apiClient } from './apiClient';
import { mockGithubService } from './mocks/mockGithubService';
import type {
  Repository,
  BranchInfo,
  CommitInfo,
  PullRequestInfo,
  GithubContentsData,
  GithubFile,
  CommitFileRequest,
  CommitFileResponse,
} from '../types/repository';
import type { GitHubIntegrationStatus } from '../types/integration';

const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';

interface BackendApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export const githubService = {
  connectGitHub: async (): Promise<void> => {
    if (USE_MOCK_DATA) {
      await mockGithubService.connectGitHub();
      return;
    }
    const res = await apiClient.get<BackendApiResponse<{ url: string }>>(
      '/v1/integrations/github/connect'
    );
    if (res.data?.url) {
      window.location.href = res.data.url;
    }
  },

  getConnectionStatus: async (): Promise<GitHubIntegrationStatus> => {
    if (USE_MOCK_DATA) {
      return mockGithubService.getConnectionStatus();
    }
    try {
      const res = await apiClient.get<
        BackendApiResponse<{ connected: boolean; username?: string; avatarUrl?: string; createdAt?: string }>
      >('/v1/integrations/github/status');

      const isConnected = res.data?.connected ?? false;

      return {
        status: isConnected ? 'connected' : 'not_connected',
        connected: isConnected,
        username: res.data?.username,
        avatarUrl: res.data?.avatarUrl,
        connectedAt: res.data?.createdAt,
        connectedAccount: isConnected && res.data?.username ? {
          username: res.data.username,
          avatarUrl: res.data.avatarUrl,
          connectedAt: res.data.createdAt || 'Connected',
        } : undefined,
      };
    } catch {
      return { status: 'not_connected', connected: false };
    }
  },

  disconnectGitHub: async (): Promise<GitHubIntegrationStatus> => {
    if (USE_MOCK_DATA) {
      return mockGithubService.disconnectGitHub();
    }
    await apiClient.post('/v1/integrations/github/disconnect');
    return { status: 'not_connected', connected: false };
  },

  getRepositories: async (): Promise<Repository[]> => {
    if (USE_MOCK_DATA) {
      return mockGithubService.getRepositories();
    }
    const res = await apiClient.get<BackendApiResponse<Repository[]>>(
      '/v1/integrations/github/repositories'
    );
    return res.data || [];
  },

  getRepository: async (id: string): Promise<Repository | undefined> => {
    if (USE_MOCK_DATA) {
      return mockGithubService.getRepository(id);
    }
    const res = await apiClient.get<BackendApiResponse<Repository>>(
      `/v1/integrations/github/repositories/${id}`
    );
    return res.data;
  },

  getBranches: async (id: string): Promise<BranchInfo[]> => {
    if (USE_MOCK_DATA) {
      return mockGithubService.getBranches(id);
    }
    const res = await apiClient.get<BackendApiResponse<BranchInfo[]>>(
      `/v1/integrations/github/repositories/${id}/branches`
    );
    return res.data || [];
  },

  getCommits: async (id: string): Promise<CommitInfo[]> => {
    if (USE_MOCK_DATA) {
      return mockGithubService.getCommits(id);
    }
    const res = await apiClient.get<BackendApiResponse<CommitInfo[]>>(
      `/v1/integrations/github/repositories/${id}/commits`
    );
    return res.data || [];
  },

  getPullRequests: async (id: string): Promise<PullRequestInfo[]> => {
    if (USE_MOCK_DATA) {
      return mockGithubService.getPullRequests(id);
    }
    const res = await apiClient.get<BackendApiResponse<PullRequestInfo[]>>(
      `/v1/integrations/github/repositories/${id}/pull-requests`
    );
    return res.data || [];
  },

  getRepositoryContents: async (
    id: string,
    path = '',
    branch?: string
  ): Promise<GithubContentsData> => {
    if (USE_MOCK_DATA) {
      return mockGithubService.getRepositoryContents(id, path, branch);
    }
    const params = new URLSearchParams();
    if (path) params.append('path', path);
    if (branch) params.append('branch', branch);
    const queryString = params.toString() ? `?${params.toString()}` : '';

    const res = await apiClient.get<BackendApiResponse<GithubContentsData>>(
      `/v1/integrations/github/repositories/${id}/contents${queryString}`
    );
    return res.data || { path, branch: branch || 'main', items: [] };
  },

  getRepositoryFile: async (
    id: string,
    path: string,
    branch?: string
  ): Promise<GithubFile> => {
    if (USE_MOCK_DATA) {
      return mockGithubService.getRepositoryFile(id, path, branch);
    }
    const params = new URLSearchParams();
    params.append('path', path);
    if (branch) params.append('branch', branch);

    const res = await apiClient.get<BackendApiResponse<GithubFile>>(
      `/v1/integrations/github/repositories/${id}/contents/file?${params.toString()}`
    );
    return res.data;
  },

  updateRepositoryFile: async (
    id: string,
    data: CommitFileRequest
  ): Promise<CommitFileResponse> => {
    if (USE_MOCK_DATA) {
      return mockGithubService.updateRepositoryFile(id, data);
    }
    const res = await apiClient.put<BackendApiResponse<CommitFileResponse>>(
      `/v1/integrations/github/repositories/${id}/contents/file`,
      data
    );
    return res.data;
  },
};

