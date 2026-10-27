import React from 'react';
import { Activity, CheckCircle2, XCircle, PlayCircle, Info, Rocket, Boxes, Container, Workflow } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../ui/GlassCard';
import type { RecentActivityFeedItem } from '../../types/dashboard';

interface RecentActivityFeedCardProps {
  activity: RecentActivityFeedItem[];
}

export const RecentActivityFeedCard: React.FC<RecentActivityFeedCardProps> = ({ activity }) => {
  const navigate = useNavigate();

  const getCategoryIcon = (category: RecentActivityFeedItem['category']) => {
    switch (category) {
      case 'deployment':
        return <Rocket className="h-3.5 w-3.5 text-purple-400" />;
      case 'kubernetes':
        return <Boxes className="h-3.5 w-3.5 text-blue-400" />;
      case 'docker':
        return <Container className="h-3.5 w-3.5 text-amber-400" />;
      case 'pipeline':
      default:
        return <Workflow className="h-3.5 w-3.5 text-emerald-400" />;
    }
  };

  const getStatusIcon = (status: RecentActivityFeedItem['status']) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircle2 className="h-3 w-3 text-emerald-400" />;
      case 'FAILED':
        return <XCircle className="h-3 w-3 text-rose-400" />;
      case 'RUNNING':
        return <PlayCircle className="h-3 w-3 text-blue-400 animate-pulse" />;
      case 'INFO':
      default:
        return <Info className="h-3 w-3 text-white/40" />;
    }
  };

  return (
    <GlassCard className="flex flex-col justify-between space-y-4 border-white/[0.08] p-5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/70">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Recent Engineering Activity</h3>
            <p className="text-xs text-white/50">Chronological feed of CI/CD, deployment, and cluster events</p>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      {activity.length === 0 ? (
        <div className="py-8 text-center text-xs text-white/45 rounded-xl border border-dashed border-white/10 bg-white/[0.01]">
          No recent engineering activity recorded yet.
        </div>
      ) : (
        <div className="space-y-3 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-px before:bg-white/[0.06]">
          {activity.slice(0, 7).map((item) => (
            <div
              key={item.id}
              onClick={() => item.link && navigate(item.link)}
              className="flex items-start gap-3 pl-1 group cursor-pointer"
            >
              <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#0d0d0d] border border-white/15 group-hover:border-white/30 transition-colors">
                {getCategoryIcon(item.category)}
              </div>

              <div className="flex-1 min-w-0 bg-white/[0.01] hover:bg-white/[0.03] p-2 rounded-xl border border-transparent hover:border-white/10 transition-all">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-semibold text-white truncate group-hover:text-blue-300 transition-colors">
                      {item.title}
                    </span>
                    {getStatusIcon(item.status)}
                  </div>
                  <span className="text-[10px] font-mono text-white/40 shrink-0">
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 mt-0.5 text-[11px] text-white/50">
                  <span className="truncate">{item.description}</span>
                  {item.resource && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/[0.04] text-white/60 shrink-0">
                      {item.resource}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
};
