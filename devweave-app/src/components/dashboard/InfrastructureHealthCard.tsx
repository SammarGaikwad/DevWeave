import React from 'react';
import { Server, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../ui/GlassCard';
import { StatusBadge } from '../ui/StatusBadge';
import { infrastructureData } from '../../data/dashboardData';

export const InfrastructureHealthCard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <GlassCard className="flex flex-col justify-between h-full space-y-4 border-white/[0.08]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Server className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-white">Infrastructure Health</h3>
        </div>
        <button
          onClick={() => navigate('/kubernetes')}
          className="text-xs text-white/50 hover:text-white inline-flex items-center gap-1 transition-colors"
        >
          View Clusters
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-2.5">
        {infrastructureData.map((svc) => (
          <div
            key={svc.id}
            className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-white/90">{svc.name}</span>
              {svc.details && (
                <span className="hidden sm:inline text-[11px] text-white/40">
                  • {svc.details}
                </span>
              )}
            </div>
            <StatusBadge status={svc.status} size="sm" />
          </div>
        ))}
      </div>
    </GlassCard>
  );
};
