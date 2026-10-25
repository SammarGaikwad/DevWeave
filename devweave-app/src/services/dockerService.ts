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

  // ----------------- Manage Docker API -----------------
  async getInventory(): Promise<DockerInventorySnapshot> {
    const res = await apiClient.get<{
      success: boolean;
      data: DockerInventorySnapshot;
    }>('/v1/docker/manage/inventory');
    return res.data;
  },

  async getAuditLogs(limit = 50): Promise<DockerAuditEvent[]> {
    const res = await apiClient.get<{
      success: boolean;
      data: DockerAuditEvent[];
    }>(`/v1/docker/manage/audit-logs?limit=${limit}`);
    return res.data;
  },

  // Container Lifecycle & CRUD
  async startContainer(containerId: string): Promise<{ started: boolean; containerId: string }> {
    const res = await apiClient.post<{
      success: boolean;
      data: { started: boolean; containerId: string };
    }>(`/v1/docker/manage/containers/${containerId}/start`);
    return res.data;
  },

  async stopContainer(containerId: string, timeoutSeconds = 10): Promise<{ stopped: boolean; containerId: string }> {
    const res = await apiClient.post<{
      success: boolean;
      data: { stopped: boolean; containerId: string };
    }>(`/v1/docker/manage/containers/${containerId}/stop`, { timeoutSeconds });
    return res.data;
  },

  async restartContainer(containerId: string, timeout = 10): Promise<{ restarted: boolean; containerId: string }> {
    const res = await apiClient.post<{
      success: boolean;
      data: { restarted: boolean; containerId: string };
    }>(`/v1/docker/manage/containers/${containerId}/restart`, { timeout });
    return res.data;
  },

  async deleteContainer(containerId: string, stopFirst = false): Promise<{ deleted: boolean; containerId: string }> {
    const query = stopFirst ? '?stopFirst=true' : '';
    const res = await apiClient.delete<{
      success: boolean;
      data: { deleted: boolean; containerId: string };
    }>(`/v1/docker/manage/containers/${containerId}${query}`, {
      body: JSON.stringify({ stopFirst }),
    });
    return res.data;
  },

  async getContainerLogs(containerId: string, tail = 200, timestamps = true): Promise<{ logs: string }> {
    const res = await apiClient.get<{
      success: boolean;
      data: { logs: string };
    }>(`/v1/docker/manage/containers/${containerId}/logs?tail=${tail}&timestamps=${timestamps}`);
    return res.data;
  },

  async inspectContainer(containerId: string): Promise<Record<string, any>> {
    const res = await apiClient.get<{
      success: boolean;
      data: Record<string, any>;
    }>(`/v1/docker/manage/containers/${containerId}/inspect`);
    return res.data;
  },

  async createContainer(params: CreateContainerParams): Promise<{ created: boolean; containerId: string; name: string }> {
    const res = await apiClient.post<{
      success: boolean;
      data: { created: boolean; containerId: string; name: string };
    }>('/v1/docker/manage/containers', params);
    return res.data;
  },

  async recreateContainer(params: RecreateContainerParams): Promise<{ recreated: boolean; containerId: string; name: string }> {
    const res = await apiClient.post<{
      success: boolean;
      data: { recreated: boolean; containerId: string; name: string };
    }>(`/v1/docker/manage/containers/${params.containerId}/recreate`, params);
    return res.data;
  },

  // Image Management
  async tagImage(sourceImage: string, targetTag: string): Promise<{ tagged: boolean; sourceImage: string; targetImage: string }> {
    const res = await apiClient.post<{
      success: boolean;
      data: { tagged: boolean; sourceImage: string; targetImage: string };
    }>('/v1/docker/manage/images/tag', { sourceImage, targetTag });
    return res.data;
  },

  async deleteImage(imageIdOrTag: string, force = false): Promise<{ deleted: boolean; imageIdOrTag: string }> {
    const query = force ? '?force=true' : '';
    const res = await apiClient.delete<{
      success: boolean;
      data: { deleted: boolean; imageIdOrTag: string };
    }>(`/v1/docker/manage/images/${encodeURIComponent(imageIdOrTag)}${query}`, {
      body: JSON.stringify({ imageIdOrTag, force }),
    });
    return res.data;
  },

  async pruneDanglingImages(): Promise<{ pruned: boolean; output: string }> {
    const res = await apiClient.post<{
      success: boolean;
      data: { pruned: boolean; output: string };
    }>('/v1/docker/manage/images/prune-dangling');
    return res.data;
  },

  // Network Management
  async createNetwork(params: { name: string; driver?: 'bridge' | 'overlay' | 'macvlan'; options?: Record<string, string> }): Promise<{ created: boolean; name: string }> {
    const res = await apiClient.post<{
      success: boolean;
      data: { created: boolean; name: string };
    }>('/v1/docker/manage/networks', params);
    return res.data;
  },

  async deleteNetwork(networkIdOrName: string): Promise<{ deleted: boolean; networkIdOrName: string }> {
    const res = await apiClient.delete<{
      success: boolean;
      data: { deleted: boolean; networkIdOrName: string };
    }>(`/v1/docker/manage/networks/${encodeURIComponent(networkIdOrName)}`);
    return res.data;
  },

  async connectNetwork(networkIdOrName: string, containerId: string): Promise<{ connected: boolean }> {
    const res = await apiClient.post<{
      success: boolean;
      data: { connected: boolean };
    }>(`/v1/docker/manage/networks/${encodeURIComponent(networkIdOrName)}/connect`, { networkIdOrName, containerId });
    return res.data;
  },

  async disconnectNetwork(networkIdOrName: string, containerId: string): Promise<{ disconnected: boolean }> {
    const res = await apiClient.post<{
      success: boolean;
      data: { disconnected: boolean };
    }>(`/v1/docker/manage/networks/${encodeURIComponent(networkIdOrName)}/disconnect`, { networkIdOrName, containerId });
    return res.data;
  },

  // Volume Management
  async createVolume(params: { name: string; driver?: string; labels?: Record<string, string> }): Promise<{ created: boolean; name: string }> {
    const res = await apiClient.post<{
      success: boolean;
      data: { created: boolean; name: string };
    }>('/v1/docker/manage/volumes', params);
    return res.data;
  },

  async deleteVolume(volumeName: string): Promise<{ deleted: boolean; volumeName: string }> {
    const res = await apiClient.delete<{
      success: boolean;
      data: { deleted: boolean; volumeName: string };
    }>(`/v1/docker/manage/volumes/${encodeURIComponent(volumeName)}`);
    return res.data;
  },
};

export interface DockerContainerSummary {
  id: string;
  name: string;
  image: string;
  imageId?: string;
  status: string;
  state: 'running' | 'exited' | 'paused' | 'restarting' | 'dead' | 'created';
  created: string;
  ports: Array<{ hostPort?: number; containerPort: number; protocol: string }>;
  isProtected: boolean;
  cpuPercent?: string;
  memoryUsage?: string;
}

export interface DockerImageSummary {
  id: string;
  repository: string;
  tag: string;
  size: string;
  created: string;
  inUseByContainers: string[];
  isProtected: boolean;
  isDangling: boolean;
}

export interface DockerNetworkSummary {
  id: string;
  name: string;
  driver: string;
  scope: string;
  containers: string[];
  isProtected: boolean;
}

export interface DockerVolumeSummary {
  name: string;
  driver: string;
  mountpoint?: string;
  inUseByContainers: string[];
  isProtected: boolean;
}

export interface DockerInventorySnapshot {
  containers: DockerContainerSummary[];
  images: DockerImageSummary[];
  networks: DockerNetworkSummary[];
  volumes: DockerVolumeSummary[];
  runnerOnline: boolean;
  updatedAt: string;
}

export interface DockerAuditEvent {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  resourceType: 'container' | 'image' | 'network' | 'volume' | 'system';
  resourceName: string;
  status: 'ATTEMPT' | 'BLOCKED_PROTECTION' | 'SUCCESS' | 'FAILED';
  details?: Record<string, any>;
  error?: string;
}

export interface CreateContainerParams {
  name: string;
  image: string;
  ports?: Array<{ hostPort?: number; containerPort: number; protocol?: 'tcp' | 'udp' }>;
  envVars?: Array<{ key: string; value: string }>;
  volumes?: Array<{ hostVolumeOrPath: string; containerPath: string; mode?: 'ro' | 'rw' }>;
  network?: string;
  restartPolicy?: 'no' | 'always' | 'on-failure' | 'unless-stopped';
  command?: string;
}

export interface RecreateContainerParams extends CreateContainerParams {
  containerId: string;
}

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

