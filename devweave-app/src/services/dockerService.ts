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
};

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
