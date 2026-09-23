import { apiClient } from './apiClient';

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
