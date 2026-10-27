import { apiClient } from './apiClient';
import type { DashboardPeriod, DashboardSummaryResponse } from '../types/dashboard';

export const dashboardService = {
  getSummary: async (period: DashboardPeriod = '7d'): Promise<DashboardSummaryResponse> => {
    const res = await apiClient.get<{
      success: boolean;
      data: DashboardSummaryResponse;
    }>(`/v1/dashboard/summary?period=${period}`);
    return res.data;
  },
};
