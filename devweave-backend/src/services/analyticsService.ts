import { isDbAvailable, prisma } from '../config/database.js';

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

export async function calculateAnalyticsOverview(): Promise<AnalyticsSummary> {
  let isDbOnline = false;
  try {
    isDbOnline = await isDbAvailable();
  } catch {
    isDbOnline = false;
  }

  if (isDbOnline) {
    try {
      const [repoCount, pipelineCount, runs] = await Promise.all([
        prisma.repository.count(),
        prisma.repositoryPipeline.count(),
        prisma.pipelineRun.findMany({
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: { stageRuns: true },
        }),
      ]);

      if (runs.length > 0) {
        const successful = runs.filter((r) => r.status === 'SUCCESS').length;
        const failed = runs.filter((r) => r.status === 'FAILED' || r.status === 'ABORTED').length;
        const inProgress = runs.filter((r) => r.status === 'RUNNING' || r.status === 'QUEUED').length;
        const rate = Math.round((successful / runs.length) * 100);

        const completedWithDuration = runs.filter((r) => typeof r.durationMs === 'number' && r.durationMs > 0);
        const durationsSec = completedWithDuration.map((r) => Math.round((r.durationMs || 0) / 1000));
        const avgDuration =
          durationsSec.length > 0
            ? Math.round(durationsSec.reduce((a, b) => a + b, 0) / durationsSec.length)
            : 0;
        const minDuration = durationsSec.length > 0 ? Math.min(...durationsSec) : 0;
        const maxDuration = durationsSec.length > 0 ? Math.max(...durationsSec) : 0;

        // Daily activity (last 7 days)
        const dailyMap: Record<string, { success: number; failed: number }> = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = d.toISOString().split('T')[0];
          dailyMap[key] = { success: 0, failed: 0 };
        }

        runs.forEach((r) => {
          const day = r.createdAt.toISOString().split('T')[0];
          if (dailyMap[day]) {
            if (r.status === 'SUCCESS') dailyMap[day].success += 1;
            if (r.status === 'FAILED') dailyMap[day].failed += 1;
          }
        });

        // Stage failure hotspots
        const stageFailures: Record<string, number> = {};
        runs.forEach((r) => {
          r.stageRuns.forEach((s) => {
            if (s.status === 'FAILED') {
              stageFailures[s.name] = (stageFailures[s.name] || 0) + 1;
            }
          });
        });

        const stageFailureHotspots = Object.entries(stageFailures)
          .map(([stageName, failureCount]) => ({ stageName, failureCount }))
          .sort((a, b) => b.failureCount - a.failureCount)
          .slice(0, 5);

        return {
          isDemoFallback: false,
          totalRepositories: repoCount,
          totalPipelines: pipelineCount,
          totalRuns: runs.length,
          successfulRuns: successful,
          failedRuns: failed,
          inProgressRuns: inProgress,
          successRate: rate,
          durationMetrics: {
            avgDurationSec: avgDuration,
            minDurationSec: minDuration,
            maxDurationSec: maxDuration,
          },
          dailyActivity: Object.entries(dailyMap).map(([date, counts]) => ({
            date,
            ...counts,
          })),
          stageFailureHotspots,
        };
      }
    } catch (err) {
      console.warn('Analytics database aggregation encountered error', err);
    }
  }

  // Graceful baseline when DB is fresh or empty
  const now = new Date();
  const demoDaily: { date: string; success: number; failed: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    demoDaily.push({
      date: d.toISOString().split('T')[0],
      success: i === 0 ? 3 : i === 2 ? 4 : 2,
      failed: i === 1 ? 1 : 0,
    });
  }

  return {
    isDemoFallback: true,
    totalRepositories: 3,
    totalPipelines: 4,
    totalRuns: 18,
    successfulRuns: 16,
    failedRuns: 2,
    inProgressRuns: 0,
    successRate: 89,
    durationMetrics: {
      avgDurationSec: 42,
      minDurationSec: 18,
      maxDurationSec: 95,
    },
    dailyActivity: demoDaily,
    stageFailureHotspots: [
      { stageName: 'Run Tests, If Configured', failureCount: 2 },
      { stageName: 'Build Docker Image', failureCount: 1 },
    ],
  };
}
