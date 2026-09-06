import type { ComponentType } from 'react';
import type { StatusType } from '../components/ui/StatusBadge';

export type DeploymentStatus = 'successful' | 'running' | 'failed' | 'pending';

export type EnvironmentFilter = 'All Environments' | 'Development' | 'Staging' | 'Production';

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
