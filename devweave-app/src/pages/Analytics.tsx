import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  GitBranch,
  Workflow,
  AlertTriangle,
  Info,
  Calendar,
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import {
  analyticsService,
  type AnalyticsSummary,
} from '../services/analyticsService';

export const Analytics: React.FC = () => {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summary = await analyticsService.getOverview();
      setData(summary);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch {
      setError('Unable to fetch platform analytics. Please verify backend connectivity.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  const maxDailyRuns = data
    ? Math.max(1, ...data.dailyActivity.map((d) => d.success + d.failed))
    : 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <BarChart3 className="h-7 w-7 text-blue-400" />
              DevOps & Pipeline Analytics
            </h1>
            <StatusBadge
              status={data?.isDemoFallback ? 'Pending' : 'Healthy'}
              customLabel={
                data?.isDemoFallback ? 'Illustrative Baseline' : 'Live Database Telemetry'
              }
            />
          </div>
          <p className="text-sm text-white/60 mt-1">
            Quantifiable build success rates, cycle durations, daily run volume, and stage failure hotspots.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-xs font-mono text-white/40 hidden sm:inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Updated {lastRefreshed}
            </span>
          )}
          <button
            onClick={() => void fetchAnalytics()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/80 hover:text-white hover:bg-white/[0.08] text-xs font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            <span>Recalculate Metrics</span>
          </button>
        </div>
      </div>

      {/* 2. Transparency Banner */}
      {data?.isDemoFallback && (
        <GlassCard className="p-4 border-amber-500/20 bg-amber-500/5 flex items-start gap-3">
          <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-white/70 leading-relaxed">
            <span className="font-semibold text-amber-300 block">Baseline Demonstration Dataset</span>
            <p>
              Your database currently has zero recorded historical pipeline executions. The metrics below display an illustrative baseline reflecting expected multi-service pipeline performance. As builds run through Jenkins, this dashboard automatically replaces baseline data with live aggregations.
            </p>
          </div>
        </GlassCard>
      )}

      {error && (
        <GlassCard className="p-4 border-rose-500/20 bg-rose-500/10 flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => void fetchAnalytics()}
            className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200"
          >
            Retry
          </button>
        </GlassCard>
      )}

      {/* 3. Primary Metrics Grid */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Runs */}
          <GlassCard className="p-5 space-y-2">
            <div className="flex items-center justify-between text-white/40">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Pipeline Runs</span>
              <Workflow className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">{data.totalRuns}</div>
            <div className="flex items-center gap-2 text-xs text-white/60">
              <span className="text-emerald-400 font-semibold">{data.successfulRuns} passed</span>
              <span>&bull;</span>
              <span className="text-rose-400 font-semibold">{data.failedRuns} failed</span>
            </div>
          </GlassCard>

          {/* Success Rate */}
          <GlassCard className="p-5 space-y-2">
            <div className="flex items-center justify-between text-white/40">
              <span className="text-xs font-semibold uppercase tracking-wider">Success Rate</span>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">{data.successRate}%</div>
            <div className="w-full bg-white/[0.08] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${data.successRate}%` }}
              ></div>
            </div>
          </GlassCard>

          {/* Average Duration */}
          <GlassCard className="p-5 space-y-2">
            <div className="flex items-center justify-between text-white/40">
              <span className="text-xs font-semibold uppercase tracking-wider">Average Build Time</span>
              <Clock className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {data.durationMetrics.avgDurationSec}s
            </div>
            <p className="text-xs text-white/50">
              Min: {data.durationMetrics.minDurationSec}s &bull; Max: {data.durationMetrics.maxDurationSec}s
            </p>
          </GlassCard>

          {/* Managed Repositories */}
          <GlassCard className="p-5 space-y-2">
            <div className="flex items-center justify-between text-white/40">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Repositories</span>
              <GitBranch className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">{data.totalRepositories}</div>
            <p className="text-xs text-white/50">{data.totalPipelines} configured pipelines</p>
          </GlassCard>
        </div>
      )}

      {/* 4. Activity Visualizer & Failure Hotspots Grid */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Daily Activity Chart */}
          <GlassCard className="lg:col-span-8 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-400" />
                  Past 7 Days Execution Volume
                </h3>
                <p className="text-xs text-white/50 mt-0.5">
                  Daily distribution of successful builds vs failures.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Success
                </span>
                <span className="inline-flex items-center gap-1.5 text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-400"></span> Failed
                </span>
              </div>
            </div>

            {/* CSS Bar Chart */}
            <div className="grid grid-cols-7 gap-3 pt-6 items-end h-52">
              {data.dailyActivity.map((day, idx) => {
                const total = day.success + day.failed;
                const heightPercent = total > 0 ? Math.round((total / maxDailyRuns) * 100) : 6;
                const successPercent = total > 0 ? Math.round((day.success / total) * 100) : 100;

                return (
                  <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end group">
                    <span className="text-[10px] font-mono text-white/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      {total} runs
                    </span>
                    <div
                      className="w-full rounded-lg bg-white/[0.05] border border-white/[0.08] p-1 flex flex-col justify-end overflow-hidden transition-all duration-300 group-hover:bg-white/[0.08]"
                      style={{ height: `${Math.max(15, heightPercent)}%` }}
                    >
                      <div
                        className="w-full bg-rose-500/80 rounded-b transition-all"
                        style={{ height: `${100 - successPercent}%` }}
                      ></div>
                      <div
                        className="w-full bg-emerald-500/80 rounded-t transition-all"
                        style={{ height: `${successPercent}%` }}
                      ></div>
                    </div>
                    <span className="text-[11px] font-mono text-white/60">
                      {day.date.split('-').slice(1).join('/')}
                    </span>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* Stage Failure Hotspots */}
          <GlassCard className="lg:col-span-4 p-6 space-y-4">
            <div className="border-b border-white/[0.08] pb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Stage Failure Hotspots
              </h3>
              <p className="text-xs text-white/50 mt-0.5">
                Pipeline stages with highest historical failure counts.
              </p>
            </div>

            <div className="space-y-3">
              {data.stageFailureHotspots.length === 0 ? (
                <div className="py-8 text-center text-xs text-white/40">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-2 opacity-80" />
                  <p>Zero failing stages recorded.</p>
                </div>
              ) : (
                data.stageFailureHotspots.map((hotspot, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white truncate max-w-[170px]">
                        {hotspot.stageName}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold">
                        {hotspot.failureCount} Failures
                      </span>
                    </div>
                    <p className="text-[11px] text-white/50">
                      Recommend reviewing Vitest test isolation and Dockerfile validation.
                    </p>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};
