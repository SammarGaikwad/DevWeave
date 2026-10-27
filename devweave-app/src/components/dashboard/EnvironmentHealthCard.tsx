import React from 'react';
import { Rocket, ArrowUpRight, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { GlassCard } from '../ui/GlassCard';

interface EnvironmentHealthCardProps {
  environments: Array<{
    id: string;
    name: string;
    status: string;
    strategy: string;
    url: string | null;
    version: string | null;
    commitSha: string | null;
    deployedAt: string | null;
    podHealth?: { ready: number; desired: number; restarting: number } | null;
    lastHealthCheck?: {
      timestamp: string;
      status: string;
      latencyMs?: number;
      statusCode?: number;
    } | null;
  }>;
}

export const EnvironmentHealthCard: React.FC<EnvironmentHealthCardProps> = ({ environments }) => {
  const navigate = useNavigate();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Healthy':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Healthy
          </span>
        );
      case 'Deploying':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            Deploying
          </span>
        );
      case 'Failed':
      case 'Degraded':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            {status}
          </span>
        );
      case 'Not configured':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/[0.04] text-white/50 border border-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            {status || 'Unknown'}
          </span>
        );
    }
  };

  return (
    <GlassCard className="flex flex-col justify-between space-y-4 border-white/[0.08] p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Rocket className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Environment Deployments</h3>
            <p className="text-xs text-white/50">Verified release status across runtime targets</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/deployments')}
          className="text-xs text-white/50 hover:text-white inline-flex items-center gap-1 transition-colors"
        >
          Deployments Hub
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Environments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {environments.map((env) => (
          <div
            key={env.id}
            onClick={() => navigate('/deployments')}
            className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/15 hover:bg-white/[0.04] transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white group-hover:text-purple-300 transition-colors">
                {env.name}
              </span>
              {getStatusBadge(env.status)}
            </div>

            {/* Health detail & Pod info */}
            <div className="space-y-1">
              {env.podHealth ? (
                <div className="flex items-center gap-1.5 text-xs font-mono text-white/80">
                  <Activity className="h-3 w-3 text-emerald-400" />
                  <span>
                    {env.podHealth.ready}/{env.podHealth.desired} Pods Ready
                  </span>
                </div>
              ) : env.lastHealthCheck ? (
                <div className="flex items-center gap-1.5 text-xs font-mono text-white/70">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      env.lastHealthCheck.status === 'HEALTHY' ? 'bg-emerald-400' : 'bg-rose-400'
                    }`}
                  />
                  <span>
                    HTTP {env.lastHealthCheck.statusCode || 200}
                    {env.lastHealthCheck.latencyMs ? ` (${env.lastHealthCheck.latencyMs}ms)` : ''}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-white/40">Health monitor pending</span>
              )}

              <div className="flex items-center justify-between text-[11px] text-white/50 font-mono pt-1">
                <span>Commit: {env.commitSha ? env.commitSha.substring(0, 7) : 'None'}</span>
                <span>{env.strategy || 'RollingUpdate'}</span>
              </div>
            </div>

            {/* Timestamp */}
            <div className="text-[10px] text-white/40 font-mono border-t border-white/[0.04] pt-2">
              {env.deployedAt ? `Deployed ${new Date(env.deployedAt).toLocaleDateString()}` : 'Not deployed'}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
};
