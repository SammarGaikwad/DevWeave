import React, { useState } from 'react';
import { Workflow, CheckCircle2, XCircle, BarChart3, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../ui/GlassCard';
import type { DashboardPeriod, PipelineTrendBucket } from '../../types/dashboard';

interface PipelineTrendsCardProps {
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  buckets: PipelineTrendBucket[];
  totalExecutions: number;
  successful: number;
  failed: number;
  running: number;
  successRate: number | null;
  isLoading?: boolean;
}

export const PipelineTrendsCard: React.FC<PipelineTrendsCardProps> = ({
  period,
  onPeriodChange,
  buckets,
  totalExecutions,
  successful,
  failed,
  running,
  successRate,
  isLoading = false,
}) => {
  const navigate = useNavigate();
  const [hoveredBucket, setHoveredBucket] = useState<PipelineTrendBucket | null>(null);

  const maxBucketTotal = Math.max(...buckets.map((b) => b.total), 1);


  return (
    <GlassCard className="flex flex-col justify-between space-y-4 border-white/[0.08] p-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Pipeline Performance & Trends</h3>
            <p className="text-xs text-white/50">Execution volume and success rate over time</p>
          </div>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.08] self-start sm:self-auto">
          {(['7d', '30d', '90d'] as DashboardPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              disabled={isLoading}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                period === p
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Breakdown Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <span className="text-[10px] uppercase font-mono text-white/40">Total Volume</span>
          <div className="text-lg font-bold font-mono text-white mt-0.5">{totalExecutions}</div>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <span className="text-[10px] uppercase font-mono text-emerald-400/80">Success Rate</span>
          <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
            {successRate !== null ? `${successRate}%` : 'N/A'}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <span className="text-[10px] uppercase font-mono text-emerald-400/80">Passed</span>
          <div className="text-lg font-bold font-mono text-white mt-0.5 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            {successful}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <span className="text-[10px] uppercase font-mono text-rose-400/80">Failed</span>
          <div className="text-lg font-bold font-mono text-white mt-0.5 flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5 text-rose-400" />
            {failed}
          </div>
        </div>
      </div>

      {/* Interactive Chart Section */}
      {totalExecutions === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 rounded-xl border border-dashed border-white/10 bg-white/[0.01] text-center space-y-2">
          <Workflow className="h-8 w-8 text-white/20" />
          <p className="text-xs font-medium text-white/70">
            No pipeline executions recorded in the selected period ({period}).
          </p>
          <p className="text-[11px] text-white/40 max-w-sm">
            Trigger a Jenkins or repository pipeline to begin collecting live execution metrics and build analytics.
          </p>
          <button
            onClick={() => navigate('/pipelines')}
            className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-medium hover:bg-blue-600/30 transition-colors"
          >
            Go to Pipelines
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="space-y-2 pt-2">
          {/* SVG Bar Chart with Responsive Layout */}
          <div className="relative pt-6 pb-2">
            {/* Tooltip Float */}
            {hoveredBucket && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md bg-[#161616] border border-white/15 text-[11px] text-white/90 shadow-lg font-mono flex items-center gap-3 z-10 pointer-events-none">
                <span>{hoveredBucket.date}</span>
                <span className="text-emerald-400">{hoveredBucket.successful} passed</span>
                {hoveredBucket.failed > 0 && <span className="text-rose-400">{hoveredBucket.failed} failed</span>}
                {hoveredBucket.running > 0 && <span className="text-blue-400">{hoveredBucket.running} active</span>}
                <span className="text-white/60">Rate: {hoveredBucket.successRate}%</span>
              </div>
            )}

            <div className="flex items-end justify-between gap-1 h-28 w-full border-b border-white/10 pb-1 px-1">
              {buckets.map((b) => {
                const totalHeightPct = Math.round((b.total / maxBucketTotal) * 100);
                const successPct = b.total > 0 ? (b.successful / b.total) * 100 : 0;
                const failedPct = b.total > 0 ? (b.failed / b.total) * 100 : 0;
                const runningPct = b.total > 0 ? (b.running / b.total) * 100 : 0;

                return (
                  <div
                    key={b.date}
                    onMouseEnter={() => setHoveredBucket(b)}
                    onMouseLeave={() => setHoveredBucket(null)}
                    className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                  >
                    {b.total === 0 ? (
                      <div className="w-full max-w-[14px] h-1 rounded bg-white/[0.04] group-hover:bg-white/10 transition-colors" />
                    ) : (
                      <div
                        style={{ height: `${Math.max(totalHeightPct, 8)}%` }}
                        className="w-full max-w-[16px] rounded-t flex flex-col justify-end overflow-hidden transition-all group-hover:opacity-80 group-hover:scale-x-110"
                      >
                        {runningPct > 0 && (
                          <div style={{ height: `${runningPct}%` }} className="bg-blue-500 w-full" />
                        )}
                        {failedPct > 0 && (
                          <div style={{ height: `${failedPct}%` }} className="bg-rose-500 w-full" />
                        )}
                        {successPct > 0 && (
                          <div style={{ height: `${successPct}%` }} className="bg-emerald-500 w-full" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Date Labels */}
            <div className="flex justify-between items-center text-[10px] font-mono text-white/40 pt-1.5 px-1">
              <span>{buckets[0]?.label}</span>
              {buckets.length > 10 && <span>{buckets[Math.floor(buckets.length / 2)]?.label}</span>}
              <span>{buckets[buckets.length - 1]?.label}</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end gap-4 text-[11px] text-white/50 pt-2 border-t border-white/[0.06]">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              <span>Passed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
              <span>Failed</span>
            </div>
            {running > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-blue-500 animate-pulse" />
                <span>Running</span>
              </div>
            )}
          </div>
        </div>
      )}
    </GlassCard>
  );
};
