import React from 'react';
import { Server, Boxes, Container, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { GlassCard } from '../ui/GlassCard';
import type { DashboardMetricSummary } from '../../types/dashboard';

interface InfrastructureSummaryCardProps {
  infrastructure: DashboardMetricSummary['infrastructure'];
}

export const InfrastructureSummaryCard: React.FC<InfrastructureSummaryCardProps> = ({ infrastructure }) => {
  const navigate = useNavigate();
  const { kubernetes, docker } = infrastructure;

  const getStatusBadge = (status: 'CONNECTED' | 'DISCONNECTED' | 'RUNNER_OFFLINE') => {
    switch (status) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Connected
          </span>
        );
      case 'DISCONNECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Disconnected
          </span>
        );
      case 'RUNNER_OFFLINE':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            Runner Offline
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
            <Server className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Infrastructure Overview</h3>
            <p className="text-xs text-white/50">Desktop runners, Kubernetes cluster, and Docker daemon</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/kubernetes')}
            className="text-xs text-white/50 hover:text-white inline-flex items-center gap-1 transition-colors"
          >
            Kubernetes
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
          <span className="text-white/20">•</span>
          <button
            onClick={() => navigate('/docker')}
            className="text-xs text-white/50 hover:text-white inline-flex items-center gap-1 transition-colors"
          >
            Docker
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Two Columns: Kubernetes & Docker */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Kubernetes Box */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition-all space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Boxes className="h-4 w-4 text-blue-400" />
              <span className="text-xs font-semibold text-white">Kubernetes</span>
              {kubernetes.currentContext && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-white/50">
                  {kubernetes.currentContext}
                </span>
              )}
            </div>
            {getStatusBadge(kubernetes.status)}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.03]">
              <span className="text-[10px] text-white/40 block">Nodes Ready</span>
              <span className="text-white font-bold">
                {kubernetes.nodes.ready} / {kubernetes.nodes.total}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.03]">
              <span className="text-[10px] text-white/40 block">Running Pods</span>
              <span className="text-emerald-400 font-bold">
                {kubernetes.pods.running} / {kubernetes.pods.total}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.03]">
              <span className="text-[10px] text-white/40 block">Deployments</span>
              <span className="text-white font-bold">{kubernetes.deploymentsCount}</span>
            </div>
            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.03]">
              <span className="text-[10px] text-white/40 block">Services</span>
              <span className="text-white font-bold">{kubernetes.servicesCount}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-white/40 border-t border-white/[0.04]">
            <span>
              {kubernetes.runnerOnline ? 'Runner online' : 'Runner offline'}
            </span>
            <button
              onClick={() => navigate('/kubernetes')}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              Open Cluster
            </button>
          </div>
        </div>

        {/* Docker Box */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition-all space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Container className="h-4 w-4 text-purple-400" />
              <span className="text-xs font-semibold text-white">Docker Daemon</span>
            </div>
            {getStatusBadge(docker.status)}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.03]">
              <span className="text-[10px] text-white/40 block">Running</span>
              <span className="text-emerald-400 font-bold">{docker.containers.running}</span>
            </div>
            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.03]">
              <span className="text-[10px] text-white/40 block">Stopped</span>
              <span className="text-white font-bold">{docker.containers.stopped}</span>
            </div>
            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.03]">
              <span className="text-[10px] text-white/40 block">Total Containers</span>
              <span className="text-white font-bold">{docker.containers.total}</span>
            </div>
            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.03]">
              <span className="text-[10px] text-white/40 block">Images Cached</span>
              <span className="text-white font-bold">{docker.imagesCount}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-white/40 border-t border-white/[0.04]">
            <span>
              {docker.runnerOnline ? 'Desktop runner active' : 'Desktop runner offline'}
            </span>
            <button
              onClick={() => navigate('/docker')}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              Manage Docker
            </button>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};
