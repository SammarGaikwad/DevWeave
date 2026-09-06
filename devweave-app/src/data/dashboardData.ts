import {
  GitBranch,
  Workflow,
  Rocket,
  Server,
} from 'lucide-react';
import type {
  DashboardStat,
  Deployment,
  ActivityItem,
  RepositoryItem,
  InfrastructureService,
} from '../types/dashboard';

export const systemHealthData = {
  status: 'Healthy' as const,
  message: 'All connected services are operating normally.',
  servicesTotal: 12,
  servicesHealthy: 12,
  incidents: 0,
};

export const dashboardStatsData: DashboardStat[] = [
  {
    id: 'repositories',
    title: 'Repositories',
    value: 12,
    description: '10 active, 2 archived',
    icon: GitBranch,
    path: '/repositories',
  },
  {
    id: 'pipelines',
    title: 'Pipelines',
    value: 24,
    description: '21 successful, 3 failed',
    icon: Workflow,
    path: '/pipelines',
  },
  {
    id: 'deployments',
    title: 'Deployments',
    value: 18,
    description: '16 successful, 2 pending',
    icon: Rocket,
    path: '/deployments',
  },
  {
    id: 'infrastructure',
    title: 'Infrastructure',
    value: 8,
    description: '7 healthy, 1 warning',
    icon: Server,
    path: '/kubernetes',
  },
];

export const cicdHealthData = {
  successful: 21,
  failed: 3,
  running: 2,
  total: 26,
};

export const infrastructureData: InfrastructureService[] = [
  { id: 'k8s', name: 'Kubernetes', status: 'Healthy', details: '3 clusters operational' },
  { id: 'docker', name: 'Docker', status: 'Healthy', details: 'Container engine online' },
  { id: 'monitoring', name: 'Monitoring', status: 'Healthy', details: 'Prometheus & Grafana active' },
  { id: 'db', name: 'Database', status: 'Warning', details: 'Response time elevated (+12%)' },
];

export const recentDeploymentsData: Deployment[] = [
  {
    id: 'dep-1',
    application: 'DevWeave API',
    environment: 'Production',
    status: 'successful',
    branch: 'main',
    time: '8 min ago',
    commitHash: '7f3a9b1',
  },
  {
    id: 'dep-2',
    application: 'Dashboard',
    environment: 'Staging',
    status: 'running',
    branch: 'develop',
    time: '14 min ago',
    commitHash: 'e4d82c0',
  },
  {
    id: 'dep-3',
    application: 'Auth Service',
    environment: 'Production',
    status: 'failed',
    branch: 'main',
    time: '31 min ago',
    commitHash: '9b1c4e7',
  },
  {
    id: 'dep-4',
    application: 'Payment Gateway',
    environment: 'Staging',
    status: 'successful',
    branch: 'main',
    time: '1 hour ago',
    commitHash: '3a5f7d2',
  },
  {
    id: 'dep-5',
    application: 'Notification Worker',
    environment: 'Production',
    status: 'successful',
    branch: 'release/1.4',
    time: '2 hours ago',
    commitHash: '6c2b1e8',
  },
];

export const recentActivityData: ActivityItem[] = [
  {
    id: 'act-1',
    type: 'deployment',
    title: 'Deployment completed',
    description: 'DevWeave API deployed to production',
    timestamp: '8 minutes ago',
  },
  {
    id: 'act-2',
    type: 'pipeline',
    title: 'Pipeline completed',
    description: 'dashboard-build #128 passed standard suite',
    timestamp: '15 minutes ago',
  },
  {
    id: 'act-3',
    type: 'repository',
    title: 'Repository updated',
    description: 'New commit pushed to devweave-app on main',
    timestamp: '24 minutes ago',
  },
  {
    id: 'act-4',
    type: 'warning',
    title: 'Warning detected',
    description: 'Database response time increased on prod-db-01',
    timestamp: '38 minutes ago',
  },
];

export const recentRepositoriesData: RepositoryItem[] = [
  {
    id: 'repo-1',
    name: 'devweave-app',
    branch: 'main',
    updatedAt: 'Updated 8 min ago',
    visibility: 'private',
  },
  {
    id: 'repo-2',
    name: 'devweave-api',
    branch: 'develop',
    updatedAt: 'Updated 24 min ago',
    visibility: 'private',
  },
  {
    id: 'repo-3',
    name: 'auth-service',
    branch: 'main',
    updatedAt: 'Updated 1 hour ago',
    visibility: 'private',
  },
  {
    id: 'repo-4',
    name: 'monitoring-service',
    branch: 'develop',
    updatedAt: 'Updated 2 hours ago',
    visibility: 'public',
  },
];
