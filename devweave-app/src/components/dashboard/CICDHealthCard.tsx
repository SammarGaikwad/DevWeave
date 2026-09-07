import React from 'react';
import { Workflow, CheckCircle2, XCircle, PlayCircle } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { cicdHealthData } from '../../data/dashboardData';

export const CICDHealthCard: React.FC = () => {
  const { successful, failed, running, total } = cicdHealthData;
  const successPct = Math.round((successful / total) * 100);
  const failedPct = Math.round((failed / total) * 100);
  const runningPct = Math.round((running / total) * 100);

  return (
    <GlassCard className="flex flex-col justify-between h-full space-y-4 border-white/[0.08]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Workflow className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-white">CI/CD Health</h3>
        </div>
        <span className="text-xs font-mono text-white/50">{total} Total Runs</span>
      </div>

      {/* Horizontal Stacked Bar */}
      <div className="space-y-2">
        <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-white/[0.05] p-0.5 border border-white/10 gap-0.5">
          <div
            title={`Successful: ${successful} (${successPct}%)`}
            style={{ width: `${successPct}%` }}
            className="h-full rounded-l-full bg-emerald-500 transition-all duration-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
          />
          <div
            title={`Failed: ${failed} (${failedPct}%)`}
            style={{ width: `${failedPct}%` }}
            className="h-full bg-rose-500 transition-all duration-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"
          />
          <div
            title={`Running: ${running} (${runningPct}%)`}
            style={{ width: `${runningPct}%` }}
            className="h-full rounded-r-full bg-blue-500 transition-all duration-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]"
          />
        </div>

        <div className="flex items-center justify-between text-xs text-white/40 pt-1 font-mono">
          <span>Success rate: {successPct}%</span>
          <span>Active builds: {running}</span>
        </div>
      </div>

      {/* Breakdown Rows */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-white/[0.06]">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <div>
            <p className="text-[10px] text-white/40 font-medium uppercase">Successful</p>
            <p className="text-sm font-mono font-bold text-white">{successful}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
          <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
          <div>
            <p className="text-[10px] text-white/40 font-medium uppercase">Failed</p>
            <p className="text-sm font-mono font-bold text-rose-400">{failed}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
          <PlayCircle className="h-4 w-4 text-blue-400 shrink-0" />
          <div>
            <p className="text-[10px] text-white/40 font-medium uppercase">Running</p>
            <p className="text-sm font-mono font-bold text-blue-400">{running}</p>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};
