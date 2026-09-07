import React from 'react';
import { FolderGit2, CheckCircle2, Archive, Clock } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';

interface RepositoryOverviewProps {
  total: number;
  active: number;
  archived: number;
  recentlyUpdated: number;
}

export const RepositoryOverview: React.FC<RepositoryOverviewProps> = ({
  total,
  active,
  archived,
  recentlyUpdated,
}) => {
  const cards = [
    {
      title: 'Total Repositories',
      value: total,
      icon: FolderGit2,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    },
    {
      title: 'Active',
      value: active,
      icon: CheckCircle2,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
    {
      title: 'Archived',
      value: archived,
      icon: Archive,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    },
    {
      title: 'Recently Updated',
      value: recentlyUpdated,
      icon: Clock,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <span className="text-[10px] uppercase font-bold text-white/40 bg-white/[0.04] border border-white/10 px-2 py-0.5 rounded-full">
          Demo data
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <GlassCard key={c.title} className="p-4 border-white/[0.08] flex items-center gap-3">
              <div className={`p-2.5 rounded-xl border ${c.color} shrink-0`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider truncate">
                  {c.title}
                </p>
                <p className="text-xl sm:text-2xl font-mono font-bold text-white tracking-tight">
                  {c.value}
                </p>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
};
