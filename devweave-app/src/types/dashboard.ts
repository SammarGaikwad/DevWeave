import type { ComponentType } from 'react';
import type { StatusType } from '../components/ui/StatusBadge';

export type DeploymentStatus = 'successful' | 'running' | 'failed' | 'pending';

export type EnvironmentFilter = 'All Environments' | 'Development' | 'Staging' | 'Production';

export type DashboardPeriod = '7d' | '30d' | '90d';

export interface DashboardStat {
  id: string;
  title: string;
  value: string | number;
  description: string;
  icon: ComponentType<{ className?: string }>;
  status?: StatusType;
  trend?: string;
  path?: string;
}

export interface Deployment {
  id: string;
  application: string;
  environment: 'Production' | 'Staging' | 'Development';
  status: DeploymentStatus;
  branch: string;
  time: string;
  commitHash?: string;
}

export interface ActivityItem {
  id: string;
  type: 'deployment' | 'pipeline' | 'repository' | 'warning';
  title: string;
  description: string;
  timestamp: string;
}

export interface RepositoryItem {
  id: string;
  name: string;
  branch: string;
  updatedAt: string;
  visibility: 'public' | 'private';
}

export interface InfrastructureService {
  id: string;
  name: string;
  status: StatusType;
  details?: string;
}

// ----------------------------------------------------
// Real Data-Driven Dashboard Types (Live API Integration)
// ----------------------------------------------------

export interface IntegrationHealthItem {
  id: 'backend' | 'database' | 'github' | 'jenkins' | 'kubernetes_runner' | 'docker_runner' | 'deployments';
  name: string;
  status: 'HEALTHY' | 'DEGRADED' | 'OFFLINE' | 'NOT_CONFIGURED';
  label: string;
  details: string;
  lastChecked: string;
  actionUrl: string;
  actionLabel: string;
}

export interface DashboardMetricSummary {
  repositories: {
    totalAccessible: number;
    configuredInDevWeave: number;
    activeCount: number;
    archivedCount: number;
    isGithubConnected: boolean;
    githubUsername: string | null;
    latestActivityAt: string | null;
  };
  pipelines: {
    period: DashboardPeriod;
    totalExecutions: number;
    successful: number;
    failed: number;
    running: number;
    successRate: number | null;
    hasExecutions: boolean;
  };
  deployments: {
    configuredEnvironments: number;
    healthyEnvironments: number;
    successfulDeployments: number;
    failedDeployments: number;
    inProgressDeployments: number;
    totalDeployments: number;
  };
  infrastructure: {
    kubernetes: {
      clusterConnected: boolean;
      runnerOnline: boolean;
      status: 'CONNECTED' | 'DISCONNECTED' | 'RUNNER_OFFLINE';
      currentContext: string | null;
      nodes: { total: number; ready: number };
      pods: { total: number; running: number; pending: number; failed: number };
      deploymentsCount: number;
      servicesCount: number;
      lastSyncAt: string | null;
    };
    docker: {
      daemonConnected: boolean;
      runnerOnline: boolean;
      status: 'CONNECTED' | 'DISCONNECTED' | 'RUNNER_OFFLINE';
      containers: { total: number; running: number; stopped: number };
      imagesCount: number;
      lastSyncAt: string | null;
    };
  };
}

export interface PipelineTrendBucket {
  date: string;
  label: string;
  successful: number;
  failed: number;
  running: number;
  total: number;
  successRate: number;
}

export interface RecentExecutionItem {
  id: string;
  source: 'JENKINS' | 'PIPELINE_RUN';
  pipelineName: string;
  repositoryName: string;
  branch: string;
  commitSha: string | null;
  status: 'SUCCESS' | 'FAILURE' | 'BUILDING' | 'ABORTED' | 'UNSTABLE' | 'NOT_BUILT' | 'UNKNOWN';
  startedAt: string;
  durationMs: number | null;
  triggerSource: string;
  logsUrl?: string;
}

export interface RecentRepositoryItem {
  id: string;
  name: string;
  fullName?: string;
  defaultBranch: string;
  visibility: string;
  updatedAt: string | null;
  source: 'GITHUB' | 'DEVWEAVE';
}

export interface RecentActivityFeedItem {
  id: string;
  category: 'pipeline' | 'deployment' | 'kubernetes' | 'docker' | 'repository';
  type: string;
  title: string;
  description: string;
  timestamp: string;
  status: 'SUCCESS' | 'FAILED' | 'RUNNING' | 'INFO';
  resource?: string;
  link?: string;
}

export interface DashboardSummaryResponse {
  integrationHealth: {
    overallStatus: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    healthyCount: number;
    totalCount: number;
    message: string;
    integrations: IntegrationHealthItem[];
  };
  metrics: DashboardMetricSummary;
  pipelineTrends: {
    period: DashboardPeriod;
    buckets: PipelineTrendBucket[];
  };
  recentExecutions: RecentExecutionItem[];
  recentRepositories: RecentRepositoryItem[];
  environments: Array<{
    id: string;
    name: string;
    status: string;
    strategy: string;
    url: string | null;
    version: string | null;
    commitSha: string | null;
    deployedAt: string | null;
    podHealth?: { ready: number; desired: number; restarting: number } | null;
    lastHealthCheck?: {
      timestamp: string;
      status: string;
      latencyMs?: number;
      statusCode?: number;
    } | null;
  }>;
  recentActivity: RecentActivityFeedItem[];
  meta: {
    timestamp: string;
    period: DashboardPeriod;
    userId: string;
  };
}
