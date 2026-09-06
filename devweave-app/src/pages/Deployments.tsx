import React from 'react';
import { Rocket, CheckCircle2, History } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { StatusBadge } from '../components/ui/StatusBadge';

export const Deployments: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Deployments</h1>
            <StatusBadge status="Pending" customLabel="Upcoming Phase" />
          </div>
          <p className="text-sm text-white/60 mt-1">
            Environment releases, zero-downtime rollouts, and rollback controls.
          </p>
        </div>
        <button
          disabled
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white/40 text-sm font-medium cursor-not-allowed opacity-75"
        >
          <Rocket className="h-4 w-4" />
          New Deployment
        </button>
      </div>

      <GlassCard className="p-8 text-center space-y-4 max-w-2xl mx-auto my-12">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
          <Rocket className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold text-white">Deployments Module</h3>
        <p className="text-sm text-white/60 max-w-md mx-auto leading-relaxed">
          This module is being built. Multi-environment deployments and canary rollouts will be available in the next development phase.
        </p>
        <div className="pt-2 flex justify-center items-center gap-4 text-xs text-white/40">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Blue/Green Support
          </span>
          <span className="inline-flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" /> Instant Rollbacks
          </span>
        </div>
      </GlassCard>
    </div>
  );
};
