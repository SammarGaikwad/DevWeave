import { apiClient } from './apiClient';

export interface AnalyticsSummary {
  isDemoFallback: boolean;
  totalRepositories: number;
  totalPipelines: number;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  inProgressRuns: number;
  successRate: number;
  durationMetrics: {
    avgDurationSec: number;
    minDurationSec: number;
    maxDurationSec: number;
  };
  dailyActivity: {
    date: string;
    success: number;
    failed: number;
  }[];
  stageFailureHotspots: {
    stageName: string;
    failureCount: number;
  }[];
}

export const analyticsService = {
  async getOverview(): Promise<AnalyticsSummary> {
    const res = await apiClient.get<{ success: boolean; data: AnalyticsSummary }>('/v1/analytics/overview');
    return res.data;
  },
};
