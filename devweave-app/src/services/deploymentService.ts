import { apiClient } from './apiClient';

export interface EnvironmentSummary {
  id: 'production' | 'staging' | 'development';
  name: 'Production' | 'Staging' | 'Development';
  type: 'production' | 'staging' | 'development';
  description: string;
  url: string | null;
  strategy: 'RollingUpdate' | 'Blue/Green' | 'Canary';
  status: 'Healthy' | 'Deploying' | 'Failed' | 'Degraded' | 'Unknown' | 'Not configured';
  healthMessage: string;
  version: string | null;
  commitSha: string | null;
  commitMessage: string | null;
  deployedAt: string | null;
  replicas: string | null;
  podHealth?: { ready: number; desired: number; restarting: number } | null;
  workloadTarget?: { kind: string; name: string; namespace: string } | null;
  isRollbackSupported: boolean;
  requiresApproval: boolean;
  lastHealthCheck: {
    timestamp: string;
    status: 'HEALTHY' | 'UNHEALTHY' | 'UNKNOWN';
    latencyMs?: number;
    statusCode?: number;
    error?: string;
  } | null;
}

export interface DeploymentExecutionRecord {
  id: string;
  environment: 'Production' | 'Staging' | 'Development';
  repositoryId?: string;
  repositoryName: string;
  branch: string;
  commitSha: string | null;
  commitMessage: string | null;
  author: string | null;
  status: 'SUCCESS' | 'RUNNING' | 'FAILED' | 'ABORTED' | 'QUEUED';
  strategy: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  triggerSource: 'MANUAL' | 'PIPELINE' | 'WEBHOOK' | 'ROLLBACK';
  userEmail?: string;
  logsUrl?: string;
  logs?: string;
  isRollbackTarget?: boolean;
}

export interface EnvironmentDetail extends EnvironmentSummary {
  livePods: Array<{
    name: string;
    namespace: string;
    phase: string;
    status: string;
    readyContainers: number;
    totalContainers: number;
    restarts: number;
    age: string;
    images: string[];
  }>;
  recentHistory: DeploymentExecutionRecord[];
  rollbackTargets: Array<{
    executionId: string;
    commitSha: string | null;
    commitMessage: string | null;
    author: string | null;
    completedAt: string | null;
  }>;
  auditTrail: Array<{
    id: string;
    action: string;
    environment: string;
    userId: string;
    userEmail?: string;
    timestamp: string;
    status: string;
    details: Record<string, any>;
  }>;
}

export interface TriggerDeploymentPayload {
  environment: string;
  repositoryId?: string;
  repositoryName?: string;
  branch: string;
  commitSha?: string;
  strategy?: string;
}

export interface RollbackDeploymentPayload {
  targetCommitSha?: string;
  targetRunId?: string;
  reason?: string;
}

export const deploymentService = {
  getEnvironments: async (forceProbe = false): Promise<EnvironmentSummary[]> => {
    const res = await apiClient.get<{ success: boolean; data: EnvironmentSummary[] }>(
      `/v1/deployments/environments${forceProbe ? '?forceProbe=true' : ''}`
    );
    return res.data || [];
  },

  getEnvironmentDetails: async (envId: string): Promise<EnvironmentDetail> => {
    const res = await apiClient.get<{ success: boolean; data: EnvironmentDetail }>(
      `/v1/deployments/environments/${envId}`
    );
    return res.data;
  },

  getDeploymentHistory: async (options?: {
    environment?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: DeploymentExecutionRecord[]; total: number }> => {
    const params = new URLSearchParams();
    if (options?.environment) params.append('environment', options.environment);
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await apiClient.get<{
      success: boolean;
      data: { items: DeploymentExecutionRecord[]; total: number };
    }>(`/v1/deployments/history${query}`);
    return res.data;
  },

  triggerDeployment: async (
    payload: TriggerDeploymentPayload
  ): Promise<DeploymentExecutionRecord> => {
    const res = await apiClient.post<{ success: boolean; data: DeploymentExecutionRecord }>(
      '/v1/deployments/trigger',
      payload
    );
    return res.data;
  },

  rollbackDeployment: async (
    envId: string,
    payload?: RollbackDeploymentPayload
  ): Promise<{ success: boolean; message: string; rollbackExecution: DeploymentExecutionRecord }> => {
    const res = await apiClient.post<{
      success: boolean;
      message: string;
      data: { success: boolean; message: string; rollbackExecution: DeploymentExecutionRecord };
    }>(`/v1/deployments/environments/${envId}/rollback`, payload || {});
    return res.data;
  },

  getAuditLogs: async (environment?: string) => {
    const query = environment ? `?environment=${environment}` : '';
    const res = await apiClient.get<{ success: boolean; data: any[] }>(
      `/v1/deployments/audit-logs${query}`
    );
    return res.data || [];
  },
};
