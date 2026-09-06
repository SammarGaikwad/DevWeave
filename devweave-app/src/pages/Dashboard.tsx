import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Clock } from 'lucide-react';
import { dashboardStatsData } from '../data/dashboardData';
import { DashboardStatCard } from '../components/dashboard/DashboardStatCard';
import { EnvironmentSelector } from '../components/dashboard/EnvironmentSelector';
import { SystemHealthBanner } from '../components/dashboard/SystemHealthBanner';
import { CICDHealthCard } from '../components/dashboard/CICDHealthCard';
import { InfrastructureHealthCard } from '../components/dashboard/InfrastructureHealthCard';
import { RecentDeploymentsCard } from '../components/dashboard/RecentDeploymentsCard';
import { RecentActivityCard } from '../components/dashboard/RecentActivityCard';
import { RecentRepositoriesCard } from '../components/dashboard/RecentRepositoriesCard';
import { AIInsightCard } from '../components/dashboard/AIInsightCard';
import { DashboardQuickActions } from '../components/dashboard/DashboardQuickActions';
import type { EnvironmentFilter } from '../types/dashboard';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [selectedEnv, setSelectedEnv] = useState<EnvironmentFilter>('All Environments');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedText, setLastUpdatedText] = useState('Last updated 2 minutes ago');

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setLastUpdatedText('Last updated just now');
    }, 800);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Good morning, Developer
          </h1>
          <p className="text-xs sm:text-sm text-white/60">
            Here's an overview of your engineering workspace.
          </p>
        </div>

        {/* Header Right Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <EnvironmentSelector
            currentEnv={selectedEnv}
            onChange={(env) => setSelectedEnv(env)}
          />

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/80 hover:text-white hover:bg-white/[0.08] text-xs font-medium transition-all disabled:opacity-50"
              aria-label="Refresh dashboard data"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`}
              />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-white/40">
              <Clock className="h-3 w-3" />
              {lastUpdatedText}
            </span>
          </div>
        </div>
      </div>

      {/* 2. System Health Banner */}
      <SystemHealthBanner />

      {/* 3. Overview Statistics Grid (4 columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {dashboardStatsData.map((stat) => (
          <DashboardStatCard
            key={stat.id}
            title={stat.title}
            value={stat.value}
            description={stat.description}
            icon={stat.icon}
            onClick={() => stat.path && navigate(stat.path)}
          />
        ))}
      </div>

      {/* 4. Engineering Health Section (2 columns: CI/CD + Infrastructure) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CICDHealthCard />
        <InfrastructureHealthCard />
      </div>

      {/* 5. Deployment Activity (Full width) */}
      <RecentDeploymentsCard />

      {/* 6. Activity & Repositories Section (2 columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentActivityCard />
        <RecentRepositoriesCard />
      </div>

      {/* 7. Quick Actions & AI Insight Banner */}
      <div className="space-y-4 pt-2">
        <DashboardQuickActions />
        <AIInsightCard />
      </div>
    </div>
  );
};
