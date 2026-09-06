import React from 'react';
import type { ComponentType } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { StatusBadge } from '../ui/StatusBadge';
import type { StatusType } from '../ui/StatusBadge';

interface DashboardStatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: ComponentType<{ className?: string }>;
  status?: StatusType;
  trend?: string;
  onClick?: () => void;
  className?: string;
}

export const DashboardStatCard: React.FC<DashboardStatCardProps> = ({
  title,
  value,
  description,
  icon: Icon,
  status,
  trend,
  onClick,
  className = '',
}) => {
  return (
    <GlassCard
      hover={Boolean(onClick)}
      onClick={onClick}
      className={`flex flex-col justify-between h-44 border-white/[0.08] group ${className}`}
    >
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/70 group-hover:text-blue-400 group-hover:border-blue-500/30 group-hover:bg-blue-500/10 transition-all">
            <Icon className="h-4 w-4" />
          </div>
          {status && <StatusBadge status={status} size="sm" />}
          {trend && (
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {trend}
            </span>
          )}
        </div>
        <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider group-hover:text-blue-300 transition-colors">
          {title}
        </h3>
        <p className="text-2xl font-mono font-bold text-white tracking-tight mt-1">
          {value}
        </p>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] text-xs">
        <span className="text-white/50 truncate max-w-[180px]">{description}</span>
        {onClick && (
          <ArrowUpRight className="h-3.5 w-3.5 text-white/30 group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
        )}
      </div>
    </GlassCard>
  );
};
