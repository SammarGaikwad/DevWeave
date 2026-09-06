import React from 'react';
import { Activity, Rocket, Workflow, GitCommit, AlertTriangle } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { recentActivityData } from '../../data/dashboardData';

export const RecentActivityCard: React.FC = () => {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'deployment':
        return <Rocket className="h-3.5 w-3.5 text-blue-400" />;
      case 'pipeline':
        return <Workflow className="h-3.5 w-3.5 text-emerald-400" />;
      case 'repository':
        return <GitCommit className="h-3.5 w-3.5 text-purple-400" />;
      case 'warning':
        return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
      default:
        return <Activity className="h-3.5 w-3.5 text-white/50" />;
    }
  };

  return (
    <GlassCard className="flex flex-col justify-between h-full space-y-4 border-white/[0.08]">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/70">
          <Activity className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
          <p className="text-xs text-white/50">Engineering events log</p>
        </div>
      </div>

      <div className="relative space-y-4 pl-3 before:absolute before:left-5 before:top-2 before:bottom-2 before:w-px before:bg-white/[0.08]">
        {recentActivityData.map((act) => (
          <div key={act.id} className="relative flex items-start gap-3 group">
            {/* Timeline Dot Icon */}
            <div className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0a0a0a] border border-white/20 group-hover:border-white/40 transition-colors">
              {getActivityIcon(act.type)}
            </div>

            {/* Event Description */}
            <div className="space-y-0.5 flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold text-white truncate">
                  {act.title}
                </h4>
                <span className="text-[10px] font-mono text-white/40 shrink-0">
                  {act.timestamp}
                </span>
              </div>
              <p className="text-xs text-white/60 truncate">{act.description}</p>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
};
