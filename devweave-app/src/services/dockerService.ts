import { apiClient } from './apiClient';

export interface DockerStatus {
  installed: boolean;
  cliVersion: string | null;
  daemonRunning: boolean;
  serverVersion: string | null;
  containersRunning?: number;
  containersTotal?: number;
  imagesTotal?: number;
  status: 'CONNECTED' | 'DAEMON_OFFLINE' | 'NOT_INSTALLED';
  message: string;
  setupInstructions: string[];
}

export interface DockerTemplateSummary {
  id: string;
  name: string;
  language: string;
  category: string;
  description: string;
  defaultPort: number;
  bestPractices: string[];
  composeSnippet: string;
}

export interface DockerTemplateDetail extends DockerTemplateSummary {
  content: string;
}

export interface CustomDockerParams {
  language: string;
  baseImage: string;
  port: number;
  workdir: string;
  installCmd: string;
  buildCmd: string;
  startCmd: string;
  nonRootUser: boolean;
}

export const dockerService = {
  async getStatus(): Promise<DockerStatus> {
    const res = await apiClient.get<{ success: boolean; data: DockerStatus }>('/v1/docker/status');
    return res.data;
  },

  async getTemplates(): Promise<DockerTemplateSummary[]> {
    const res = await apiClient.get<{ success: boolean; data: DockerTemplateSummary[] }>('/v1/docker/templates');
    return res.data;
  },

  async getTemplateById(id: string): Promise<DockerTemplateDetail> {
    const res = await apiClient.get<{ success: boolean; data: DockerTemplateDetail }>(`/v1/docker/templates/${id}`);
    return res.data;
  },

  async generateDockerfile(params: CustomDockerParams): Promise<{ dockerfile: string; parameters: CustomDockerParams }> {
    const res = await apiClient.post<{ success: boolean; data: { dockerfile: string; parameters: CustomDockerParams } }>(
      '/v1/docker/generate',
      params
    );
    return res.data;
  },
  async getRunnerStatus(): Promise<DockerRunnerStatus> {
    const res = await apiClient.get<{
      success: boolean;
      data: DockerRunnerStatus;
    }>('/v1/docker/runner/status');

    return res.data;
  },

  async analyzeProject(params: {
    repositoryId?: string;
    repoFullName: string;
    branch?: string;
  }): Promise<{ repoFullName: string; branch: string; analysis: DetectedStack }> {
    const res = await apiClient.post<{
      success: boolean;
      data: { repoFullName: string; branch: string; analysis: DetectedStack };
    }>('/v1/docker/analyze', params);
    return res.data;
  },

  async generateConfig(stack: DetectedStack): Promise<GeneratedDockerConfig> {
    const res = await apiClient.post<{
      success: boolean;
      data: GeneratedDockerConfig;
    }>('/v1/docker/generate-config', { stack });
    return res.data;
  },

  async createBuildJob(params: {
    repositoryId?: string;
    repoFullName: string;
    branch: string;
    imageTag: string;
    dockerfile: string;
    dockerignore?: string;
    composeFile?: string;
    detectedStack?: DetectedStack;
  }): Promise<DockerBuildJob> {
    const res = await apiClient.post<{
      success: boolean;
      data: DockerBuildJob;
    }>('/v1/docker/builds', params);
    return res.data;
  },

  async getBuildJob(id: string): Promise<DockerBuildJob> {
    const res = await apiClient.get<{
      success: boolean;
      data: DockerBuildJob;
    }>(`/v1/docker/builds/${id}`);
    return res.data;
  },

  async getBuildLogs(
    id: string,
    since?: number
  ): Promise<{
    jobId: string;
    status: DockerBuildStatus;
    logs: BuildLogEntry[];
    totalLogs: number;
    durationMs?: number;
    imageId?: string;
    imageSize?: string;
    errorDetails?: string;
  }> {
    const query = since !== undefined ? `?since=${since}` : '';
    const res = await apiClient.get<{
      success: boolean;
      data: {
        jobId: string;
        status: DockerBuildStatus;
        logs: BuildLogEntry[];
        totalLogs: number;
        durationMs?: number;
        imageId?: string;
        imageSize?: string;
        errorDetails?: string;
      };
    }>(`/v1/docker/builds/${id}/logs${query}`);
    return res.data;
  },

  async listBuildJobs(): Promise<DockerBuildJob[]> {
    const res = await apiClient.get<{
      success: boolean;
      data: DockerBuildJob[];
    }>('/v1/docker/builds');
    return res.data;
  },

  async cancelBuildJob(id: string): Promise<DockerBuildJob> {
    const res = await apiClient.post<{
      success: boolean;
      data: DockerBuildJob;
    }>(`/v1/docker/builds/${id}/cancel`);
    return res.data;
  },
};

export interface DetectedStack {
  language: string;
  framework: string;
  projectType: 'frontend' | 'backend' | 'fullstack' | 'service';
  packageManager: string;
  buildCommand?: string;
  startCommand: string;
  defaultPort: number;
  envVars: string[];
  isMonorepo: boolean;
  subprojects?: Array<{
    name: string;
    path: string;
    language: string;
    framework: string;
    port: number;
  }>;
  existingDockerfile?: string;
  existingCompose?: string;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
  assumptions: string[];
}

export interface GeneratedDockerConfig {
  dockerfile: string;
  dockerignore: string;
  composeFile?: string;
  explanations: string[];
  assumptions: string[];
  diffs?: {
    dockerfileDiff?: string;
    composeDiff?: string;
  };
}

export type DockerBuildStatus =
  | 'QUEUED'
  | 'ANALYZING'
  | 'GENERATING'
  | 'AWAITING_APPROVAL'
  | 'BUILDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMED_OUT';

export interface BuildLogEntry {
  timestamp: string;
  stage: string;
  severity: 'info' | 'warn' | 'error';
  message: string;
}

export interface DockerBuildJob {
  id: string;
  userId: string;
  repositoryId?: string;
  repoFullName: string;
  branch: string;
  status: DockerBuildStatus;
  detectedStack?: DetectedStack;
  dockerfile: string;
  dockerignore: string;
  composeFile?: string;
  imageTag: string;
  imageId?: string;
  imageSize?: string;
  logs: BuildLogEntry[];
  errorDetails?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  runnerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DockerRunnerStatus {
  online: boolean;
  lastHeartbeatAt: string | null;
  snapshot: {
    runnerId: string;
    hostname: string;
    dockerVersion: string | null;
    serverVersion: string | null;
    containersRunning: number;
    containersTotal: number;
    imagesTotal: number;
    reportedAt: string;
  } | null;
}

