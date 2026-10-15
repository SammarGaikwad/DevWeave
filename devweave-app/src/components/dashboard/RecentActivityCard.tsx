import React from 'react';
import { Activity, Workflow, CheckCircle2, XCircle, PlayCircle } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import type { BuildSummary } from '../../services/pipelineService';

export const RecentActivityCard: React.FC<{ builds: BuildSummary[] }> = ({ builds }) => {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
      case 'failed':
        return <XCircle className="h-3.5 w-3.5 text-rose-400" />;
      case 'running':
        return <PlayCircle className="h-3.5 w-3.5 text-blue-400" />;
      default:
        return <Workflow className="h-3.5 w-3.5 text-white/50" />;
      default:
        return <Activity className="h-3.5 w-3.5 text-white/50" />;
    }
  };

  const activities = builds.slice(0, 4).map((build) => ({
    id: `build-${build.number}`,
    type: build.status === 'SUCCESS' ? 'success' : ['FAILURE', 'UNSTABLE', 'ABORTED'].includes(build.status) ? 'failed' : build.status === 'BUILDING' ? 'running' : 'pipeline',
    title: `Jenkins build #${build.number} ${build.status === 'SUCCESS' ? 'completed successfully' : build.status === 'BUILDING' ? 'is running' : build.status === 'FAILURE' || build.status === 'UNSTABLE' ? 'failed' : build.status.toLowerCase()}`,
    timestamp: new Date(build.timestamp).toLocaleString(),
    description: build.commitMessage || `Build duration: ${Math.round((build.duration || 0) / 1000)} seconds`,
  }));

  return (
    <GlassCard className="flex flex-col justify-between h-full space-y-4 border-white/[0.08]">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/70">
          <Activity className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
          <p className="text-xs text-white/50">Latest Jenkins build events</p>
        </div>
      </div>

      <div className="relative space-y-4 pl-3 before:absolute before:left-5 before:top-2 before:bottom-2 before:w-px before:bg-white/[0.08]">
        {activities.length === 0 ? <p className="py-4 text-xs text-white/45">No Jenkins activity available yet.</p> : activities.map((act) => (
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
