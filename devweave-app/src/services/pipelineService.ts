import { apiClient } from './apiClient';

export interface PipelineTemplateStage {
  id: string;
  name: string;
  order: number;
  description: string;
  isOptional?: boolean;
}

export interface PipelineTemplateConfigField {
  key: string;
  label: string;
  type: 'string' | 'boolean' | 'select';
  defaultValue: any;
  required: boolean;
  description: string;
  options?: string[];
}

export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  category: 'Backend' | 'Frontend' | 'Container' | 'Full-Stack' | string;
  supportedTechnologies: string[];
  stages: PipelineTemplateStage[];
  configFields: PipelineTemplateConfigField[];
  icon: string;
}

export interface RepositoryPipeline {
  id: string;
  name: string;
  templateId: string;
  branch: string;
  config: Record<string, any>;
  jenkinsJobName: string;
  repositoryId: string;
  template?: PipelineTemplate;
  createdAt: string;
  updatedAt: string;
}

export type RunStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'ABORTED'
  | 'UNKNOWN';

export type StageRunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'ABORTED'
  | 'SKIPPED';

export interface PipelineStageRun {
  id: string;
  stageId: string;
  name: string;
  order: number;
  status: StageRunStatus;
  durationMs: number;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  repositoryId: string;
  templateId: string;
  branch: string;
  jenkinsJobName: string;
  jenkinsBuildNumber: number | null;
  jenkinsBuildUrl: string | null;
  status: RunStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  commitMessage?: string | null;
  author?: string | null;
  errorSummary?: string | null;
  stageRuns: PipelineStageRun[];
  createdAt: string;
  updatedAt: string;
}

export interface PipelineRunLogsData {
  runId: string;
  buildNumber: number | null;
  status: string;
  logs: string;
}

// Legacy types for backward compatibility
export interface PipelineStage {
  id: string;
  name: string;
  status: 'SUCCESS' | 'IN_PROGRESS' | 'FAILED' | 'PAUSED' | 'ABORTED' | 'PENDING';
  durationMillis: number;
}

export interface BuildSummary {
  number: number;
  url: string;
  status: 'SUCCESS' | 'FAILURE' | 'BUILDING' | 'NOT_BUILT' | 'ABORTED' | 'UNSTABLE' | 'UNKNOWN';
  timestamp: number;
  duration: number;
  commitMessage?: string;
  author?: string;
  stages?: PipelineStage[];
}

export interface PipelineStatusData {
  name: string;
  url: string;
  status: 'SUCCESS' | 'FAILURE' | 'BUILDING' | 'NOT_BUILT' | 'ABORTED' | 'UNSTABLE' | 'UNKNOWN';
  latestBuild: BuildSummary | null;
  builds: BuildSummary[];
}

interface BackendApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export const pipelineService = {
  // Predefined templates
  listTemplates: async (): Promise<PipelineTemplate[]> => {
    const res = await apiClient.get<BackendApiResponse<PipelineTemplate[]>>(
      '/v1/pipeline-templates'
    );
    return res.data || [];
  },

  getTemplate: async (id: string): Promise<PipelineTemplate> => {
    const res = await apiClient.get<BackendApiResponse<PipelineTemplate>>(
      `/v1/pipeline-templates/${id}`
    );
    return res.data;
  },

  // Repository pipelines
  getRepositoryPipelines: async (repositoryId: string): Promise<RepositoryPipeline[]> => {
    const res = await apiClient.get<BackendApiResponse<RepositoryPipeline[]>>(
      `/v1/repositories/${repositoryId}/pipelines`
    );
    return res.data || [];
  },

  configurePipeline: async (
    repositoryId: string,
    data: {
      templateId: string;
      name?: string;
      branch?: string;
      config?: Record<string, any>;
    }
  ): Promise<RepositoryPipeline> => {
    const res = await apiClient.post<BackendApiResponse<RepositoryPipeline>>(
      `/v1/repositories/${repositoryId}/pipelines`,
      data
    );
    return res.data;
  },

  // Execution triggers
  triggerPipelineRun: async (pipelineId: string): Promise<PipelineRun> => {
    const res = await apiClient.post<BackendApiResponse<PipelineRun>>(
      `/v1/pipelines/${pipelineId}/runs`
    );
    return res.data;
  },

  // Run status and logs
  getPipelineRun: async (runId: string): Promise<PipelineRun> => {
    const res = await apiClient.get<BackendApiResponse<PipelineRun>>(
      `/v1/pipeline-runs/${runId}`
    );
    return res.data;
  },

  getPipelineRunLogs: async (runId: string): Promise<PipelineRunLogsData> => {
    const res = await apiClient.get<BackendApiResponse<PipelineRunLogsData>>(
      `/v1/pipeline-runs/${runId}/logs`
    );
    return res.data;
  },

  getRepositoryRuns: async (repositoryId: string): Promise<PipelineRun[]> => {
    const res = await apiClient.get<BackendApiResponse<PipelineRun[]>>(
      `/v1/repositories/${repositoryId}/pipeline-runs`
    );
    return res.data || [];
  },

  // Legacy pipeline methods
  getPipelineStatus: async (): Promise<PipelineStatusData> => {
    const res = await apiClient.get<BackendApiResponse<PipelineStatusData>>(
      '/v1/pipelines/status'
    );
    return res.data;
  },

  getPipelineBuilds: async (): Promise<BuildSummary[]> => {
    const res = await apiClient.get<BackendApiResponse<BuildSummary[]>>(
      '/v1/pipelines/builds'
    );
    return res.data || [];
  },

  triggerPipeline: async (): Promise<{ message: string; buildUrl: string }> => {
    const res = await apiClient.post<BackendApiResponse<{ buildUrl: string }>>(
      '/v1/pipelines/trigger'
    );
    return {
      message: res.message || 'Pipeline triggered successfully',
      buildUrl: res.data?.buildUrl || '',
    };
  },
};
