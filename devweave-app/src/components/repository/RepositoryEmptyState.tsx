import React from 'react';
import { SearchX, RotateCcw } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';

interface RepositoryEmptyStateProps {
  onClearFilters: () => void;
}

export const RepositoryEmptyState: React.FC<RepositoryEmptyStateProps> = ({
  onClearFilters,
}) => {
  return (
    <GlassCard className="p-10 text-center space-y-4 max-w-lg mx-auto my-8 border-white/[0.08]">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white/40 flex items-center justify-center">
        <SearchX className="h-6 w-6" />
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-semibold text-white">No repositories found</h3>
        <p className="text-xs text-white/50">
          Try changing your search query or adjusting your selected filters.
        </p>
      </div>

      <button
        onClick={onClearFilters}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/15 border border-blue-500/30 hover:bg-blue-500/25 text-blue-300 text-xs font-semibold transition-all"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Clear Filters
      </button>
    </GlassCard>
  );
};
