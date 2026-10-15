import { apiClient } from './apiClient';

export interface ServiceHealth {
  name: string;
  category: 'Core' | 'Database' | 'CI/CD' | 'VCS';
  status: 'HEALTHY' | 'DEGRADED' | 'UNREACHABLE' | 'STANDBY';
  latencyMs: number | null;
  endpoint: string;
  details: string;
  lastChecked: string;
}

export interface SystemMonitoringSnapshot {
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  timestamp: string;
  environment: string;
  nodeVersion: string;
  uptimeSeconds: number;
  memoryUsageMb: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
  services: ServiceHealth[];
}

export interface PlatformLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  source: 'API_GATEWAY' | 'JENKINS_RUNNER' | 'DATABASE' | 'GITHUB_INTEGRATION' | 'AUTH_SERVICE';
  message: string;
  metadata?: Record<string, unknown>;
}

export const monitoringService = {
  async getSnapshot(): Promise<SystemMonitoringSnapshot> {
    const res = await apiClient.get<{ success: boolean; data: SystemMonitoringSnapshot }>('/v1/monitoring/health');
    return res.data;
  },

  async getLogs(): Promise<PlatformLogEntry[]> {
    const res = await apiClient.get<{ success: boolean; data: PlatformLogEntry[] }>('/v1/monitoring/logs');
    return res.data;
  },
};
