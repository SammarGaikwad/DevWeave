import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';

interface RepositoryErrorStateProps {
  onRetry: () => void;
  message?: string;
}

export const RepositoryErrorState: React.FC<RepositoryErrorStateProps> = ({
  onRetry,
  message = 'Unable to load repositories',
}) => {
  return (
    <GlassCard className="p-10 text-center space-y-4 max-w-lg mx-auto my-8 border-rose-500/20 bg-rose-950/10">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
        <AlertTriangle className="h-6 w-6" />
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-semibold text-white">{message}</h3>
        <p className="text-xs text-white/50">
          A temporary network or backend integration error occurred. Please try again.
        </p>
      </div>

      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 hover:bg-rose-500/30 text-white text-xs font-semibold transition-all"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Try Again
      </button>
    </GlassCard>
  );
};
