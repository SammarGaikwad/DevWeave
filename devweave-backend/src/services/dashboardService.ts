import { env } from '../config/env.js';
import { isDbAvailable } from '../config/database.js';
import * as githubService from './githubService.js';
import * as jenkinsService from './jenkinsService.js';
import { getEnvironments, getDeploymentHistory, getDeploymentAuditLogs, EnvironmentSummary } from './deploymentService.js';
import { getKubernetesRunnerSnapshot } from './kubernetesRunnerService.js';
import { checkClusterStatus } from './kubernetesService.js';
import { getKubernetesInventory } from './kubernetesManagementService.js';
import { getKubernetesAuditLogs } from './kubernetesProtectionService.js';
import { getRunnerSnapshot as getDockerRunnerSnapshot } from './dockerRunnerService.js';
import { getInventorySnapshot as getDockerInventory } from './dockerManagementService.js';
import { getAuditEvents as getDockerAuditEvents } from './dockerProtectionService.js';
import { findRecentPipelineRuns } from '../repositories/pipelineRepository.js';
import { findRepositoriesByUserId, findAllRepositories } from '../repositories/repositoryRepository.js';

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
    period: '7d' | '30d' | '90d';
    totalExecutions: number;
    successful: number;
    failed: number;
    running: number;
    successRate: number | null; // null if 0 completed runs
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
    period: '7d' | '30d' | '90d';
    buckets: PipelineTrendBucket[];
  };
  recentExecutions: RecentExecutionItem[];
  recentRepositories: RecentRepositoryItem[];
  environments: EnvironmentSummary[];
  recentActivity: RecentActivityFeedItem[];
  meta: {
    timestamp: string;
    period: '7d' | '30d' | '90d';
    userId: string;
  };
}

/**
 * Period in days helper
 */
function getPeriodDays(period: '7d' | '30d' | '90d'): number {
  switch (period) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    default:
      return 7;
  }
}

/**
 * Formats a date to YYYY-MM-DD
 */
function toDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

async function safeGetJenkinsPipelineStatus() {
  try {
    return await jenkinsService.getJenkinsPipelineStatus();
  } catch {
    return null;
  }
}

/**
 * Aggregates all live dashboard engineering data for the authenticated user.
 */
export async function getDashboardSummary(params: {
  userId: string;
  period?: '7d' | '30d' | '90d';
}): Promise<DashboardSummaryResponse> {
  const { userId } = params;
  const period = params.period || '7d';
  const periodDays = getPeriodDays(period);
  const now = new Date();
  const periodCutoffMs = now.getTime() - periodDays * 86400 * 1000;
  const nowIso = now.toISOString();

  // 1. Integration Checks (Safe, Parallel)
  const [
    dbOnline,
    githubStatusResult,
    jenkinsStatusResult,
    k8sClusterStatusResult,
    deploymentEnvsResult,
    recentDbPipelinesResult,
    userDevWeaveReposResult,
  ] = await Promise.allSettled([
    isDbAvailable(),
    githubService.getConnectionStatus(userId),
    safeGetJenkinsPipelineStatus(),
    checkClusterStatus(),
    getEnvironments(false),
    findRecentPipelineRuns({ userId, limit: 50 }),
    findRepositoriesByUserId(userId),
  ]);


  const isPostgresOnline = dbOnline.status === 'fulfilled' ? dbOnline.value : false;
  const githubStatus = githubStatusResult.status === 'fulfilled' ? githubStatusResult.value : { connected: false };
  const jenkinsStatus = jenkinsStatusResult.status === 'fulfilled' ? jenkinsStatusResult.value : null;
  const k8sCluster = k8sClusterStatusResult.status === 'fulfilled' ? k8sClusterStatusResult.value : null;
  const environments = deploymentEnvsResult.status === 'fulfilled' ? deploymentEnvsResult.value : [];
  const recentDbRuns = recentDbPipelinesResult.status === 'fulfilled' ? recentDbPipelinesResult.value : [];
  let userRepos = userDevWeaveReposResult.status === 'fulfilled' ? userDevWeaveReposResult.value : [];
  if (userRepos.length === 0) {
    try {
      userRepos = await findAllRepositories();
    } catch {
      userRepos = [];
    }
  }

  // 2. Fetch GitHub repos if GitHub is connected
  let githubRepos: any[] = [];
  if (githubStatus.connected) {
    try {
      githubRepos = await githubService.getRepositories(userId, 1, 10);
    } catch {
      githubRepos = [];
    }
  }

  // 3. Infrastructure: Kubernetes & Docker Runners
  const k8sRunner = getKubernetesRunnerSnapshot();
  const dockerRunner = getDockerRunnerSnapshot();

  let k8sInventory = null;
  if (k8sRunner.online || (k8sCluster && k8sCluster.clusterConnected)) {
    try {
      k8sInventory = getKubernetesInventory();
    } catch {
      k8sInventory = null;
    }
  }

  let dockerInventory = null;
  if (dockerRunner.online) {
    try {
      dockerInventory = getDockerInventory();
    } catch {
      dockerInventory = null;
    }
  }

  // 4. Calculate Unified Pipeline Executions
  // Combine Jenkins builds and database pipeline runs
  const unifiedExecutions: RecentExecutionItem[] = [];

  if (jenkinsStatus && Array.isArray(jenkinsStatus.builds)) {
    for (const b of jenkinsStatus.builds) {
      unifiedExecutions.push({
        id: `jenkins-${b.number}`,
        source: 'JENKINS',
        pipelineName: jenkinsStatus.name || 'Jenkins CI',
        repositoryName: env.JENKINS_JOB_NAME || 'DevWeave',
        branch: 'main',
        commitSha: b.commitMessage?.match(/[a-f0-9]{7,40}/i)?.[0] || null,
        status: b.status,
        startedAt: new Date(b.timestamp).toISOString(),
        durationMs: b.duration || null,
        triggerSource: 'Jenkins Hook',
        logsUrl: b.url,
      });
    }
  }

  for (const r of recentDbRuns) {
    unifiedExecutions.push({
      id: r.id,
      source: 'PIPELINE_RUN',
      pipelineName: r.jenkinsJobName || 'Repository Pipeline',
      repositoryName: r.repositoryId || 'Repository',
      branch: r.branch || 'main',
      commitSha: r.commitSha || null,
      status: r.status as any,
      startedAt: r.startedAt ? r.startedAt.toISOString() : r.createdAt.toISOString(),
      durationMs: r.durationMs || null,
      triggerSource: 'DevWeave API',
      logsUrl: r.jenkinsBuildUrl || undefined,
    });
  }

  // Sort all executions descending by startedAt
  unifiedExecutions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  // Filter executions for the requested reporting period
  const executionsInPeriod = unifiedExecutions.filter(
    (e) => new Date(e.startedAt).getTime() >= periodCutoffMs
  );

  const successfulRuns = executionsInPeriod.filter((e) => e.status === 'SUCCESS').length;
  const failedRuns = executionsInPeriod.filter((e) => ['FAILURE', 'ABORTED', 'UNSTABLE'].includes(e.status)).length;
  const runningRuns = executionsInPeriod.filter((e) => e.status === 'BUILDING').length;
  const completedRuns = successfulRuns + failedRuns;
  const successRate = completedRuns > 0 ? Math.round((successfulRuns / completedRuns) * 100) : null;

  // 5. Generate Trend Buckets for Visualization
  const bucketMap = new Map<string, { successful: number; failed: number; running: number }>();
  for (let i = periodDays - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400 * 1000);
    bucketMap.set(toDateKey(d), { successful: 0, failed: 0, running: 0 });
  }

  for (const e of executionsInPeriod) {
    const key = toDateKey(new Date(e.startedAt));
    if (bucketMap.has(key)) {
      const b = bucketMap.get(key)!;
      if (e.status === 'SUCCESS') b.successful++;
      else if (['FAILURE', 'ABORTED', 'UNSTABLE'].includes(e.status)) b.failed++;
      else if (e.status === 'BUILDING') b.running++;
    }
  }

  const buckets: PipelineTrendBucket[] = Array.from(bucketMap.entries()).map(([dateStr, counts]) => {
    const total = counts.successful + counts.failed + counts.running;
    const completed = counts.successful + counts.failed;
    const bucketRate = completed > 0 ? Math.round((counts.successful / completed) * 100) : 0;
    const [_, month, day] = dateStr.split('-');
    return {
      date: dateStr,
      label: `${month}/${day}`,
      successful: counts.successful,
      failed: counts.failed,
      running: counts.running,
      total,
      successRate: bucketRate,
    };
  });

  // 6. Deployment Metrics
  const deploymentHistory = await getDeploymentHistory({ limit: 100 });
  const deploymentRecords = deploymentHistory?.items || [];
  const deploymentsInPeriod = deploymentRecords.filter(
    (d) => new Date(d.startedAt).getTime() >= periodCutoffMs
  );
  const successfulDeployments = deploymentsInPeriod.filter((d) => d.status === 'SUCCESS').length;
  const failedDeployments = deploymentsInPeriod.filter((d) => d.status === 'FAILED').length;
  const inProgressDeployments = deploymentsInPeriod.filter((d) => d.status === 'RUNNING').length;
  const healthyEnvsCount = environments.filter((e) => e.status === 'Healthy').length;


  // 7. Repositories Metric
  const totalAccessibleRepos = githubStatus.connected ? githubRepos.length : userRepos.length;
  const activeUserRepos = userRepos.filter((r) => !r.archived).length;
  const archivedUserRepos = userRepos.filter((r) => r.archived).length;
  const latestRepoActivity = userRepos.length > 0 && userRepos[0].updatedAt
    ? userRepos[0].updatedAt.toISOString()
    : null;

  // 8. Integration Health Items & Overall Status
  const integrations: IntegrationHealthItem[] = [
    {
      id: 'backend',
      name: 'DevWeave Core API',
      status: 'HEALTHY',
      label: 'Operational',
      details: `Node.js + Express (port ${env.PORT || 5000}) in ${env.NODE_ENV} mode`,
      lastChecked: nowIso,
      actionUrl: '/api/health',
      actionLabel: 'Health Check',
    },
    {
      id: 'database',
      name: 'PostgreSQL Database',
      status: isPostgresOnline ? 'HEALTHY' : 'DEGRADED',
      label: isPostgresOnline ? 'Connected' : 'In-Memory Fallback',
      details: isPostgresOnline ? 'Prisma connection pool active' : 'PostgreSQL is offline; memory fallback enabled',
      lastChecked: nowIso,
      actionUrl: '/settings',
      actionLabel: 'Database Settings',
    },
    {
      id: 'github',
      name: 'GitHub Integration',
      status: githubStatus.connected ? 'HEALTHY' : 'NOT_CONFIGURED',
      label: githubStatus.connected ? `Connected (${githubStatus.username})` : 'Not Connected',
      details: githubStatus.connected
        ? `Linked as @${githubStatus.username}`
        : 'Connect GitHub to import and synchronize repositories',
      lastChecked: nowIso,
      actionUrl: '/repositories',
      actionLabel: githubStatus.connected ? 'View Repositories' : 'Connect GitHub',
    },
    {
      id: 'jenkins',
      name: 'Jenkins CI/CD',
      status: jenkinsStatus ? 'HEALTHY' : env.JENKINS_URL ? 'OFFLINE' : 'NOT_CONFIGURED',
      label: jenkinsStatus ? 'Connected' : env.JENKINS_URL ? 'Unreachable' : 'Not Configured',
      details: jenkinsStatus
        ? `Jenkins online at ${env.JENKINS_URL || 'configured host'}`
        : env.JENKINS_URL
          ? 'Unable to communicate with Jenkins endpoint'
          : 'Jenkins URL not specified in environment',
      lastChecked: nowIso,
      actionUrl: '/pipelines',
      actionLabel: 'View Pipelines',
    },
    {
      id: 'kubernetes_runner',
      name: 'Kubernetes Desktop Runner',
      status: k8sRunner.online
        ? (k8sCluster?.clusterConnected ? 'HEALTHY' : 'DEGRADED')
        : 'OFFLINE',
      label: k8sRunner.online
        ? (k8sCluster?.clusterConnected ? 'Cluster Connected' : 'Runner Waiting for Cluster')
        : 'Runner Offline',
      details: k8sRunner.online
        ? `Heartbeat active (${k8sCluster?.currentContext || 'default context'})`
        : 'Start runner locally: npm run runner:k8s',
      lastChecked: k8sRunner.lastHeartbeat || nowIso,
      actionUrl: '/kubernetes',
      actionLabel: 'Kubernetes Panel',
    },
    {
      id: 'docker_runner',
      name: 'Docker Desktop Runner',
      status: dockerRunner.online ? 'HEALTHY' : 'OFFLINE',
      label: dockerRunner.online ? 'Daemon Connected' : 'Runner Offline',
      details: dockerRunner.online
        ? `${dockerRunner.snapshot?.containersRunning ?? 0} running containers reported`
        : 'Start runner: powershell scripts/run-docker-runner.ps1',
      lastChecked: dockerRunner.lastHeartbeatAt || nowIso,
      actionUrl: '/docker',
      actionLabel: 'Docker Management',
    },
    {
      id: 'deployments',
      name: 'Deployment Environments',
      status: healthyEnvsCount === environments.length && environments.length > 0
        ? 'HEALTHY'
        : healthyEnvsCount > 0
          ? 'DEGRADED'
          : 'NOT_CONFIGURED',
      label: `${healthyEnvsCount}/${environments.length || 3} Healthy`,
      details: `Production, Staging, and Development health probe monitors`,
      lastChecked: nowIso,
      actionUrl: '/deployments',
      actionLabel: 'Deployments Hub',
    },
  ];

  const healthyCount = integrations.filter((i) => i.status === 'HEALTHY').length;
  const totalCount = integrations.length;
  const overallStatus = healthyCount >= 5 ? 'HEALTHY' : healthyCount >= 2 ? 'DEGRADED' : 'DOWN';
  const overallMessage = `${healthyCount} of ${totalCount} Services Operational`;

  // 9. Normalized Engineering Activity Feed
  const recentActivity: RecentActivityFeedItem[] = [];

  // Deployment audit events
  const deploymentAudit = getDeploymentAuditLogs().slice(0, 10);
  for (const a of deploymentAudit) {
    recentActivity.push({
      id: `deploy-audit-${a.id}`,
      category: 'deployment',
      type: a.action,
      title: a.action === 'ROLLBACK'
        ? `Rollback executed on ${a.environment}`
        : `Deployment triggered for ${a.environment}`,
      description: a.details?.commitMessage || a.details?.reason || `Target: ${a.environment}`,
      timestamp: a.timestamp,
      status: a.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
      resource: a.environment,
      link: '/deployments',
    });
  }

  // Kubernetes audit events
  const k8sAudit = getKubernetesAuditLogs().slice(0, 10);
  for (const k of k8sAudit) {
    recentActivity.push({
      id: `k8s-audit-${k.id}`,
      category: 'kubernetes',
      type: k.action,
      title: `Kubernetes ${k.action} on ${k.resourceName || k.namespace || 'Cluster'}`,
      description: k.error || `Resource: ${k.resourceKind} / ${k.resourceName || 'default'}`,
      timestamp: k.timestamp,
      status: k.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
      resource: k.resourceName || k.resourceKind || 'Cluster',
      link: '/kubernetes',
    });
  }

  // Docker audit events
  const dockerAudit = getDockerAuditEvents(10);
  for (const d of dockerAudit) {
    recentActivity.push({
      id: `docker-audit-${d.id}`,
      category: 'docker',
      type: d.action,
      title: `Docker ${d.action} on ${d.resourceType}`,
      description: d.details?.name || d.resourceName || 'Container engine operation',
      timestamp: d.timestamp,
      status: d.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
      resource: d.resourceName || d.resourceType,
      link: '/docker',
    });
  }


  // Pipeline execution events
  for (const e of unifiedExecutions.slice(0, 8)) {
    recentActivity.push({
      id: `pipe-act-${e.id}`,
      category: 'pipeline',
      type: 'PIPELINE_RUN',
      title: `${e.pipelineName} execution ${e.status === 'SUCCESS' ? 'passed' : e.status === 'BUILDING' ? 'running' : 'failed'}`,
      description: e.commitSha ? `Commit ${e.commitSha.substring(0, 7)} on ${e.branch}` : `Branch ${e.branch}`,
      timestamp: e.startedAt,
      status: e.status === 'SUCCESS' ? 'SUCCESS' : e.status === 'BUILDING' ? 'RUNNING' : 'FAILED',
      resource: e.repositoryName,
      link: '/pipelines',
    });
  }

  // Sort unified activity descending
  recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // 10. Recent Repositories Representation
  const recentRepositories: RecentRepositoryItem[] = [];
  if (githubStatus.connected && githubRepos.length > 0) {
    for (const gr of githubRepos.slice(0, 6)) {
      recentRepositories.push({
        id: String(gr.id),
        name: gr.name,
        fullName: gr.full_name,
        defaultBranch: gr.default_branch || 'main',
        visibility: gr.private ? 'PRIVATE' : 'PUBLIC',
        updatedAt: gr.updated_at || null,
        source: 'GITHUB',
      });
    }
  } else {
    for (const ur of userRepos.slice(0, 6)) {
      recentRepositories.push({
        id: ur.id,
        name: ur.name,
        fullName: ur.fullName || ur.name,
        defaultBranch: ur.defaultBranch || 'main',
        visibility: ur.visibility || 'PUBLIC',
        updatedAt: ur.updatedAt ? ur.updatedAt.toISOString() : null,
        source: 'DEVWEAVE',
      });
    }
  }

  return {
    integrationHealth: {
      overallStatus,
      healthyCount,
      totalCount,
      message: overallMessage,
      integrations,
    },
    metrics: {
      repositories: {
        totalAccessible: totalAccessibleRepos,
        configuredInDevWeave: userRepos.length,
        activeCount: activeUserRepos,
        archivedCount: archivedUserRepos,
        isGithubConnected: githubStatus.connected,
        githubUsername: githubStatus.username || null,
        latestActivityAt: latestRepoActivity,
      },
      pipelines: {
        period,
        totalExecutions: executionsInPeriod.length,
        successful: successfulRuns,
        failed: failedRuns,
        running: runningRuns,
        successRate,
        hasExecutions: executionsInPeriod.length > 0,
      },
      deployments: {
        configuredEnvironments: environments.length,
        healthyEnvironments: healthyEnvsCount,
        successfulDeployments,
        failedDeployments,
        inProgressDeployments,
        totalDeployments: deploymentsInPeriod.length,
      },
      infrastructure: {
        kubernetes: {
          clusterConnected: Boolean(k8sCluster?.clusterConnected),
          runnerOnline: Boolean(k8sRunner.online),
          status: k8sCluster?.clusterConnected
            ? 'CONNECTED'
            : k8sRunner.online
              ? 'DISCONNECTED'
              : 'RUNNER_OFFLINE',
          currentContext: k8sCluster?.currentContext || null,
          nodes: {
            total: k8sInventory?.nodes?.length || 0,
            ready: k8sInventory?.nodes?.filter((n: any) => n.status === 'Ready').length || 0,
          },
          pods: {
            total: k8sInventory?.pods?.length || 0,
            running: k8sInventory?.pods?.filter((p: any) => p.phase === 'Running' || p.status === 'Running').length || 0,
            pending: k8sInventory?.pods?.filter((p: any) => p.phase === 'Pending' || p.status === 'Pending').length || 0,
            failed: k8sInventory?.pods?.filter((p: any) => p.phase === 'Failed' || p.status === 'Failed').length || 0,
          },
          deploymentsCount: k8sInventory?.deployments?.length || 0,
          servicesCount: k8sInventory?.services?.length || 0,
          lastSyncAt: k8sRunner.lastHeartbeat || null,
        },
        docker: {
          daemonConnected: Boolean(dockerRunner.online && dockerRunner.snapshot?.dockerVersion),
          runnerOnline: Boolean(dockerRunner.online),
          status: (dockerRunner.online && dockerRunner.snapshot?.dockerVersion)
            ? 'CONNECTED'
            : dockerRunner.online
              ? 'DISCONNECTED'
              : 'RUNNER_OFFLINE',
          containers: {
            total: dockerRunner.snapshot?.containersTotal ?? (dockerInventory?.containers?.length || 0),
            running: dockerRunner.snapshot?.containersRunning ?? (dockerInventory?.containers?.filter((c: any) => c.state === 'running').length || 0),
            stopped: (dockerRunner.snapshot?.containersTotal ?? (dockerInventory?.containers?.length || 0)) -
              (dockerRunner.snapshot?.containersRunning ?? (dockerInventory?.containers?.filter((c: any) => c.state === 'running').length || 0)),
          },
          imagesCount: dockerRunner.snapshot?.imagesTotal ?? (dockerInventory?.images?.length || 0),
          lastSyncAt: dockerRunner.lastHeartbeatAt || null,
        },
      },
    },
    pipelineTrends: {
      period,
      buckets,
    },
    recentExecutions: unifiedExecutions.slice(0, 10),
    recentRepositories,
    environments,
    recentActivity: recentActivity.slice(0, 15),
    meta: {
      timestamp: nowIso,
      period,
      userId,
    },
  };
}
