import React from 'react';
import { GlassCard } from '../ui/GlassCard';

interface RepositorySkeletonProps {
  viewMode: 'list' | 'grid';
}

export const RepositorySkeleton: React.FC<RepositorySkeletonProps> = ({ viewMode }) => {
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <GlassCard key={i} className="h-56 p-5 space-y-4 animate-pulse border-white/[0.08]">
            <div className="flex items-center justify-between">
              <div className="h-8 w-8 rounded-xl bg-white/[0.06]" />
              <div className="h-5 w-16 rounded-full bg-white/[0.06]" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-3/4 rounded bg-white/[0.08]" />
              <div className="h-3 w-full rounded bg-white/[0.04]" />
              <div className="h-3 w-2/3 rounded bg-white/[0.04]" />
            </div>
            <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between">
              <div className="h-3 w-16 rounded bg-white/[0.04]" />
              <div className="h-3 w-12 rounded bg-white/[0.04]" />
            </div>
          </GlassCard>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-16 rounded-xl glass-panel border border-white/[0.06] px-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3 w-1/3">
            <div className="h-8 w-8 rounded-lg bg-white/[0.06]" />
            <div className="space-y-1 flex-1">
              <div className="h-3.5 w-32 rounded bg-white/[0.08]" />
              <div className="h-2.5 w-48 rounded bg-white/[0.04]" />
            </div>
          </div>
          <div className="h-3 w-16 rounded bg-white/[0.04]" />
          <div className="h-3 w-12 rounded bg-white/[0.04]" />
          <div className="h-5 w-16 rounded-full bg-white/[0.06]" />
        </div>
      ))}
    </div>
  );
};
