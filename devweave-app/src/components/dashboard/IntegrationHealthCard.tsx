import React from 'react';
import { ShieldCheck, AlertTriangle, AlertCircle, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { GlassCard } from '../ui/GlassCard';
import type { IntegrationHealthItem } from '../../types/dashboard';

interface IntegrationHealthCardProps {
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  healthyCount: number;
  totalCount: number;
  message: string;
  integrations: IntegrationHealthItem[];
  onRefresh?: () => void;
}

export const IntegrationHealthCard: React.FC<IntegrationHealthCardProps> = ({
  overallStatus,
  healthyCount,
  totalCount,
  message,
  integrations,
}) => {
  const navigate = useNavigate();

  const getStatusBadge = (status: IntegrationHealthItem['status']) => {
    switch (status) {
      case 'HEALTHY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Healthy
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Degraded
          </span>
        );
      case 'OFFLINE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            Offline
          </span>
        );
      case 'NOT_CONFIGURED':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/[0.04] text-white/50 border border-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            Not Configured
          </span>
        );
    }
  };

  const getOverallIcon = () => {
    if (overallStatus === 'HEALTHY') return <ShieldCheck className="h-5 w-5 text-emerald-400" />;
    if (overallStatus === 'DEGRADED') return <AlertTriangle className="h-5 w-5 text-amber-400" />;
    return <AlertCircle className="h-5 w-5 text-rose-400" />;
  };

  return (
    <GlassCard className="space-y-4 border-white/[0.08] p-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
            {getOverallIcon()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">Integration Health Panel</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.04] text-white/70 border border-white/10">
                {healthyCount}/{totalCount} Operational
              </span>
            </div>
            <p className="text-xs text-white/50">{message}</p>
          </div>
        </div>

        <button
          onClick={() => navigate('/settings')}
          className="text-xs text-white/50 hover:text-white inline-flex items-center gap-1 transition-colors self-start sm:self-auto"
        >
          Manage Integrations
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Integration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {integrations.map((item) => (
          <div
            key={item.id}
            className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 hover:bg-white/[0.03] transition-all flex flex-col justify-between space-y-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold text-white truncate">{item.name}</span>
              {getStatusBadge(item.status)}
            </div>

            <p className="text-[11px] text-white/60 line-clamp-2 min-h-[28px]">
              {item.details}
            </p>

            <div className="flex items-center justify-between pt-2 border-t border-white/[0.04] text-[10px] font-mono text-white/40">
              <span className="truncate">{item.label}</span>
              <button
                onClick={() => navigate(item.actionUrl)}
                className="text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-0.5 shrink-0 transition-colors"
              >
                {item.actionLabel}
                <ArrowUpRight className="h-2.5 w-2.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
};
