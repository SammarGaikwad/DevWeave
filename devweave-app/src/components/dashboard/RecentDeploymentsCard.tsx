import React from 'react';
import { Rocket, GitBranch, ArrowUpRight, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../ui/GlassCard';
import { StatusBadge } from '../ui/StatusBadge';
import { recentDeploymentsData } from '../../data/dashboardData';
import type { DeploymentStatus } from '../../types/dashboard';
import type { StatusType } from '../ui/StatusBadge';

export const RecentDeploymentsCard: React.FC = () => {
  const navigate = useNavigate();

  const mapDeploymentStatus = (status: DeploymentStatus): StatusType => {
    switch (status) {
      case 'successful':
        return 'Healthy';
      case 'running':
        return 'Running';
      case 'pending':
        return 'Pending';
      case 'failed':
        return 'Failed';
      default:
        return 'Offline';
    }
  };

  return (
    <GlassCard className="space-y-4 border-white/[0.08]">
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Rocket className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Recent Deployments</h3>
            <p className="text-xs text-white/50">Production & staging release activity</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/deployments')}
          className="text-xs text-white/50 hover:text-white inline-flex items-center gap-1 transition-colors"
        >
          All Deployments
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Deployments Table Container */}
      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/[0.02] text-white/40 uppercase font-semibold border-b border-white/[0.06]">
            <tr>
              <th className="py-3 px-4">Application</th>
              <th className="py-3 px-4">Environment</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Branch</th>
              <th className="py-3 px-4 text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {recentDeploymentsData.map((dep) => {
              const isFailed = dep.status === 'failed';
              return (
                <tr
                  key={dep.id}
                  className={`transition-colors hover:bg-white/[0.03] ${
                    isFailed ? 'bg-rose-500/[0.03]' : ''
                  }`}
                >
                  {/* Application Name */}
                  <td className="py-3.5 px-4 font-medium text-white">
                    <div className="flex items-center gap-2">
                      {isFailed && (
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                      )}
                      <span>{dep.application}</span>
                      {dep.commitHash && (
                        <span className="font-mono text-[10px] text-white/30">
                          #{dep.commitHash}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Environment */}
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                        dep.environment === 'Production'
                          ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                          : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                      }`}
                    >
                      {dep.environment}
                    </span>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        status={mapDeploymentStatus(dep.status)}
                        customLabel={
                          dep.status.charAt(0).toUpperCase() + dep.status.slice(1)
                        }
                        size="sm"
                      />
                      {isFailed && (
                        <button
                          onClick={() => navigate('/deployments')}
                          className="text-[10px] text-rose-400 hover:underline font-medium ml-1"
                        >
                          View details
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Branch */}
                  <td className="py-3.5 px-4 font-mono text-white/60">
                    <span className="inline-flex items-center gap-1">
                      <GitBranch className="h-3 w-3 text-white/30" />
                      {dep.branch}
                    </span>
                  </td>

                  {/* Time */}
                  <td className="py-3.5 px-4 text-right font-mono text-white/40">
                    {dep.time}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
};
