import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  Clock,
  GitBranch,
  Workflow,
  Rocket,
  Server,
  AlertCircle,
} from 'lucide-react';

import { dashboardService } from '../services/dashboardService';
import type { DashboardPeriod, DashboardSummaryResponse } from '../types/dashboard';
import { DashboardStatCard } from '../components/dashboard/DashboardStatCard';
import { PipelineTrendsCard } from '../components/dashboard/PipelineTrendsCard';
import { RecentExecutionsCard } from '../components/dashboard/RecentExecutionsCard';
import { ConnectedRepositoriesCard } from '../components/dashboard/ConnectedRepositoriesCard';
import { EnvironmentHealthCard } from '../components/dashboard/EnvironmentHealthCard';
import { InfrastructureSummaryCard } from '../components/dashboard/InfrastructureSummaryCard';
import { IntegrationHealthCard } from '../components/dashboard/IntegrationHealthCard';
import { RecentActivityFeedCard } from '../components/dashboard/RecentActivityFeedCard';
import { DashboardQuickActions } from '../components/dashboard/DashboardQuickActions';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<DashboardPeriod>('7d');
  const [data, setData] = useState<DashboardSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedText, setLastUpdatedText] = useState('Loading live metrics...');
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(
    async (selectedPeriod: DashboardPeriod, showSpinner = false) => {
      if (showSpinner) setIsRefreshing(true);
      setError(null);

      try {
        const summary = await dashboardService.getSummary(selectedPeriod);
        setData(summary);
        setLastUpdatedText(`Last updated at ${new Date().toLocaleTimeString()}`);
      } catch (err: any) {
        console.error('Failed to fetch dashboard summary:', err);
        setError(
          err.message ||
            'Unable to reach DevWeave backend API. Check your connection or sign in again.'
        );
        setLastUpdatedText('Update failed (data may be stale)');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    void fetchDashboardData(period, false);
  }, [fetchDashboardData, period]);

  const handleRefresh = () => {
    void fetchDashboardData(period, true);
  };

  const handlePeriodChange = (newPeriod: DashboardPeriod) => {
    setPeriod(newPeriod);
    void fetchDashboardData(newPeriod, true);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 pb-12">
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              DevWeave Dashboard
            </h1>
            {data && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  data.integrationHealth.overallStatus === 'HEALTHY'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : data.integrationHealth.overallStatus === 'DEGRADED'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    data.integrationHealth.overallStatus === 'HEALTHY'
                      ? 'bg-emerald-400'
                      : data.integrationHealth.overallStatus === 'DEGRADED'
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
                  }`}
                />
                {data.integrationHealth.message}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-white/60">
            Your engineering workspace for repositories, CI/CD, deployments, and infrastructure.
          </p>
        </div>

        {/* Header Right Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/80 hover:text-white hover:bg-white/[0.08] text-xs font-medium transition-all disabled:opacity-50"
            aria-label="Refresh dashboard data"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`}
            />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-white/40">
            <Clock className="h-3 w-3" />
            {lastUpdatedText}
          </span>
        </div>
      </div>

      {/* Error Alert with Retry */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={handleRefresh}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Platform Shortcuts */}
      <DashboardQuickActions />

      {/* Initial Loading Skeletons */}
      {isLoading && !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-44 rounded-2xl glass-panel animate-pulse bg-white/[0.02] border border-white/[0.06]"
              />
            ))}
          </div>
          <div className="h-64 rounded-2xl glass-panel animate-pulse bg-white/[0.02] border border-white/[0.06]" />
        </div>
      ) : data ? (
        <>
          {/* 3. Real KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Repositories */}
            <DashboardStatCard
              title="Repositories"
              value={data.metrics.repositories.totalAccessible}
              description={`${data.metrics.repositories.configuredInDevWeave} configured • ${data.metrics.repositories.activeCount} active`}
              icon={GitBranch}
              status={data.metrics.repositories.isGithubConnected ? 'Healthy' : 'Pending'}
              trend={
                data.metrics.repositories.isGithubConnected
                  ? `@${data.metrics.repositories.githubUsername}`
                  : undefined
              }
              onClick={() => navigate('/repositories')}
            />

            {/* 2. CI/CD Pipelines */}
            <DashboardStatCard
              title="CI/CD Pipelines"
              value={data.metrics.pipelines.totalExecutions}
              description={`${data.metrics.pipelines.successful} passed, ${data.metrics.pipelines.failed} failed${
                data.metrics.pipelines.running > 0
                  ? `, ${data.metrics.pipelines.running} running`
                  : ''
              } (${period})`}
              icon={Workflow}
              status={
                data.metrics.pipelines.successRate !== null && data.metrics.pipelines.successRate >= 80
                  ? 'Healthy'
                  : data.metrics.pipelines.totalExecutions === 0
                  ? 'Pending'
                  : 'Failed'
              }
              trend={
                data.metrics.pipelines.successRate !== null
                  ? `${data.metrics.pipelines.successRate}% Success`
                  : undefined
              }
              onClick={() => navigate('/pipelines')}
            />

            {/* 3. Deployments */}
            <DashboardStatCard
              title="Deployments"
              value={`${data.metrics.deployments.healthyEnvironments}/${data.metrics.deployments.configuredEnvironments}`}
              description={`${data.metrics.deployments.successfulDeployments} successful releases recorded (${period})`}
              icon={Rocket}
              status={
                data.metrics.deployments.healthyEnvironments ===
                data.metrics.deployments.configuredEnvironments
                  ? 'Healthy'
                  : data.metrics.deployments.healthyEnvironments > 0
                  ? 'Pending'
                  : 'Failed'
              }
              trend="Environments"
              onClick={() => navigate('/deployments')}
            />

            {/* 4. Infrastructure */}
            <DashboardStatCard
              title="Infrastructure"
              value={`${data.metrics.infrastructure.kubernetes.pods.running} Pods`}
              description={`${
                data.metrics.infrastructure.kubernetes.status === 'CONNECTED'
                  ? 'K8s Connected'
                  : 'K8s ' + data.metrics.infrastructure.kubernetes.status
              } • ${data.metrics.infrastructure.docker.containers.running} Containers`}
              icon={Server}
              status={
                data.metrics.infrastructure.kubernetes.status === 'CONNECTED'
                  ? 'Healthy'
                  : 'Pending'
              }
              trend={data.metrics.infrastructure.kubernetes.currentContext || 'Cluster'}
              onClick={() => navigate('/kubernetes')}
            />
          </div>

          {/* 4. Pipeline Performance & Trends Visualizer */}
          <PipelineTrendsCard
            period={period}
            onPeriodChange={handlePeriodChange}
            buckets={data.pipelineTrends.buckets}
            totalExecutions={data.metrics.pipelines.totalExecutions}
            successful={data.metrics.pipelines.successful}
            failed={data.metrics.pipelines.failed}
            running={data.metrics.pipelines.running}
            successRate={data.metrics.pipelines.successRate}
            isLoading={isRefreshing}
          />

          {/* 5. Environment Deployments & Infrastructure Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <EnvironmentHealthCard environments={data.environments} />
            <InfrastructureSummaryCard infrastructure={data.metrics.infrastructure} />
          </div>

          {/* 6. Recent Executions & Repository Activity Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RecentExecutionsCard executions={data.recentExecutions} />
            <ConnectedRepositoriesCard
              repositories={data.recentRepositories}
              isGithubConnected={data.metrics.repositories.isGithubConnected}
              githubUsername={data.metrics.repositories.githubUsername}
              totalAccessible={data.metrics.repositories.totalAccessible}
            />
          </div>

          {/* 7. Integration Health Status Panel & Recent Activity Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <IntegrationHealthCard
              overallStatus={data.integrationHealth.overallStatus}
              healthyCount={data.integrationHealth.healthyCount}
              totalCount={data.integrationHealth.totalCount}
              message={data.integrationHealth.message}
              integrations={data.integrationHealth.integrations}
            />
            <RecentActivityFeedCard activity={data.recentActivity} />
          </div>
        </>
      ) : null}
    </div>
  );
};
