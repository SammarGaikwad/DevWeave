import { mockRepositories, mockBranches, mockCommits, mockPullRequests } from '../../data/repositories';
import type {
  Repository,
  BranchInfo,
  CommitInfo,
  PullRequestInfo,
  GithubContentsData,
  GithubFile,
  CommitFileRequest,
  CommitFileResponse,
  CreateRepositoryRequest,
  CreatedRepositoryData,
} from '../../types/repository';
import type { GitHubIntegrationStatus } from '../../types/integration';

let mockConnectionState: GitHubIntegrationStatus = {
  status: 'connected',
  connectedAccount: {
    username: 'developer',
    connectedAt: '2 hours ago',
    scopes: ['repo', 'read:user', 'workflow'],
  },
};

const mockFilesDatabase: Record<string, string> = {
  'README.md': `# DevWeave Unified IDP

Welcome to DevWeave - The Developer Portal & Internal Platform.

## Features
- Repository Management
- CI/CD Pipelines
- Automated Testing & Deployment
- Live Log Monitoring
`,
  'package.json': `{
  "name": "devweave-app",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build"
  }
}
`,
  'src/App.tsx': `import React from 'react';

export default function App() {
  return (
    <div className="app-container">
      <h1>DevWeave Workspace</h1>
    </div>
  );
}
`,
  'src/index.css': `body {
  margin: 0;
  background-color: #0f172a;
  color: #f8fafc;
}
`,
};

export const mockGithubService = {
  connectGitHub: async (): Promise<GitHubIntegrationStatus> => {
    mockConnectionState = {
      status: 'connected',
      connectedAccount: {
        username: 'developer',
        connectedAt: 'Just now',
        scopes: ['repo', 'read:user', 'workflow'],
      },
    };
    return Promise.resolve(mockConnectionState);
  },

  getConnectionStatus: async (): Promise<GitHubIntegrationStatus> => {
    return Promise.resolve(mockConnectionState);
  },

  disconnectGitHub: async (): Promise<GitHubIntegrationStatus> => {
    mockConnectionState = {
      status: 'not_connected',
    };
    return Promise.resolve(mockConnectionState);
  },

  getRepositories: async (): Promise<Repository[]> => {
    if (mockConnectionState.status !== 'connected') {
      return Promise.resolve([]);
    }
    return Promise.resolve(mockRepositories);
  },

  getRepository: async (id: string): Promise<Repository | undefined> => {
    const repo = mockRepositories.find((r) => r.id === id);
    return Promise.resolve(repo);
  },

  getBranches: async (id: string): Promise<BranchInfo[]> => {
    const branches = mockBranches[id] || [
      { name: 'main', lastCommit: 'Initial commit & setup', updatedAt: '1 day ago', isDefault: true },
    ];
    return Promise.resolve(branches);
  },

  getCommits: async (id: string): Promise<CommitInfo[]> => {
    const commits = mockCommits[id] || [
      { id: 'c1', hash: 'a1b2c3', message: 'Main sync commit', author: 'Developer', timestamp: '1 hour ago' },
    ];
    return Promise.resolve(commits);
  },

  getPullRequests: async (id: string): Promise<PullRequestInfo[]> => {
    const prs = mockPullRequests[id] || [
      { id: 'pr-1', number: 1, title: 'Update documentation & API specs', status: 'Open', author: 'Developer', timestamp: '1 day ago', branch: 'patch-1' },
    ];
    return Promise.resolve(prs);
  },

  getRepositoryContents: async (
    _id: string,
    path = '',
    branch = 'main'
  ): Promise<GithubContentsData> => {
    if (path === 'src') {
      return {
        path: 'src',
        branch,
        items: [
          { name: 'App.tsx', path: 'src/App.tsx', type: 'file', size: 180, sha: 'mock-sha-app' },
          { name: 'index.css', path: 'src/index.css', type: 'file', size: 90, sha: 'mock-sha-css' },
        ],
      };
    }
    return {
      path: '',
      branch,
      items: [
        { name: 'src', path: 'src', type: 'directory' },
        { name: 'README.md', path: 'README.md', type: 'file', size: 240, sha: 'mock-sha-readme' },
        { name: 'package.json', path: 'package.json', type: 'file', size: 150, sha: 'mock-sha-pkg' },
      ],
    };
  },

  getRepositoryFile: async (
    _id: string,
    path: string,
    branch = 'main'
  ): Promise<GithubFile> => {
    const content = mockFilesDatabase[path] || `// Mock content for ${path}\nconsole.log("Hello from DevWeave mock mode!");\n`;
    const fileName = path.split('/').pop() || path;

    return {
      name: fileName,
      path,
      sha: `sha-mock-${path.replace(/[^a-zA-Z0-9]/g, '-')}`,
      branch,
      size: content.length,
      content,
    };
  },

  updateRepositoryFile: async (
    _id: string,
    data: CommitFileRequest
  ): Promise<CommitFileResponse> => {
    mockFilesDatabase[data.path] = data.content;
    const newSha = `sha-commit-${Date.now()}`;

    return {
      path: data.path,
      commit: {
        sha: newSha,
        message: data.commitMessage,
      },
    };
  },

  createRepository: async (
    data: CreateRepositoryRequest
  ): Promise<CreatedRepositoryData> => {
    const id = `github-mock-${Date.now()}`;
    const newRepo: Repository = {
      id,
      name: data.name,
      fullName: `developer/${data.name}`,
      description: data.description || 'Repository created via DevWeave',
      owner: 'developer',
      visibility: data.private ? 'private' : 'public',
      language: 'TypeScript',
      defaultBranch: 'main',
      stars: 0,
      forks: 0,
      updatedAt: 'Just now',
      status: 'Active',
      archived: false,
      source: 'GitHub',
    };
    mockRepositories.unshift(newRepo);

    return {
      id: newRepo.id,
      name: newRepo.name,
      fullName: newRepo.fullName!,
      description: newRepo.description,
      private: data.private,
      defaultBranch: 'main',
      htmlUrl: `https://github.com/developer/${data.name}`,
      cloneUrl: `https://github.com/developer/${data.name}.git`,
    };
  },
};


