import React, { useState } from 'react';
import { Rocket, ArrowUpRight, Copy, Check, Terminal, ExternalLink, GitBranch } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../ui/GlassCard';
import type { RecentExecutionItem } from '../../types/dashboard';

interface RecentExecutionsCardProps {
  executions: RecentExecutionItem[];
}

export const RecentExecutionsCard: React.FC<RecentExecutionsCardProps> = ({ executions }) => {
  const navigate = useNavigate();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopySha = (sha: string) => {

    navigator.clipboard.writeText(sha);
    setCopiedId(sha);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadge = (status: RecentExecutionItem['status']) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Success
          </span>
        );
      case 'BUILDING':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
            Running
          </span>
        );
      case 'FAILURE':
      case 'UNSTABLE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Failed
          </span>
        );
      case 'ABORTED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
            Aborted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-white/[0.04] text-white/50 border border-white/10">
            {status}
          </span>
        );
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '—';
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remSeconds = seconds % 60;
    return `${minutes}m ${remSeconds}s`;
  };

  return (
    <GlassCard className="space-y-4 border-white/[0.08] p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Rocket className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Recent Pipeline Executions</h3>
            <p className="text-xs text-white/50">Recorded builds from connected CI/CD workflows</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/pipelines')}
          className="text-xs text-white/50 hover:text-white inline-flex items-center gap-1 transition-colors"
        >
          View All Pipelines
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Table Container */}
      {executions.length === 0 ? (
        <div className="py-10 text-center rounded-xl border border-dashed border-white/10 bg-white/[0.01]">
          <Rocket className="h-8 w-8 text-white/20 mx-auto mb-2" />
          <p className="text-xs font-medium text-white/60">No recent pipeline executions found.</p>
          <p className="text-[11px] text-white/40 mt-1 max-w-sm mx-auto">
            Executions will appear here when you run pipelines for connected repositories or Jenkins jobs.
          </p>
          <button
            onClick={() => navigate('/pipelines')}
            className="mt-3 px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-medium hover:bg-blue-600/30 transition-colors"
          >
            Open Pipelines
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-white/40 font-mono border-b border-white/[0.06]">
              <tr>
                <th className="px-3.5 py-2.5 font-medium">Pipeline / Job</th>
                <th className="px-3.5 py-2.5 font-medium">Repository / Branch</th>
                <th className="px-3.5 py-2.5 font-medium">Commit SHA</th>
                <th className="px-3.5 py-2.5 font-medium">Status</th>
                <th className="px-3.5 py-2.5 font-medium">Started</th>
                <th className="px-3.5 py-2.5 font-medium">Duration</th>
                <th className="px-3.5 py-2.5 font-medium">Trigger</th>
                <th className="px-3.5 py-2.5 font-medium text-right">Logs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {executions.map((e) => (
                <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-3.5 py-3 text-white font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate max-w-[140px]">{e.pipelineName}</span>
                      <span className="text-[10px] font-mono text-white/40">#{e.id.split('-').pop()}</span>
                    </div>
                  </td>
                  <td className="px-3.5 py-3 text-white/70">
                    <div className="flex items-center gap-1 text-[11px] font-mono">
                      <span className="truncate max-w-[110px]">{e.repositoryName}</span>
                      <span className="text-white/30">•</span>
                      <span className="inline-flex items-center gap-0.5 text-white/50">
                        <GitBranch className="h-3 w-3" />
                        {e.branch}
                      </span>
                    </div>
                  </td>
                  <td className="px-3.5 py-3 font-mono text-white/70">
                    {e.commitSha ? (
                      <button
                        onClick={() => handleCopySha(e.commitSha!)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-[11px] text-white/80 transition-colors"
                        title="Click to copy commit SHA"
                      >
                        <span>{e.commitSha.substring(0, 7)}</span>
                        {copiedId === e.commitSha ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3 text-white/40" />
                        )}
                      </button>
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  <td className="px-3.5 py-3">{getStatusBadge(e.status)}</td>
                  <td className="px-3.5 py-3 font-mono text-white/60 text-[11px] whitespace-nowrap">
                    {new Date(e.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-3.5 py-3 font-mono text-white/60 text-[11px]">
                    {formatDuration(e.durationMs)}
                  </td>
                  <td className="px-3.5 py-3 text-white/50 text-[11px] capitalize">
                    {e.triggerSource}
                  </td>
                  <td className="px-3.5 py-3 text-right">
                    {e.logsUrl ? (
                      <a
                        href={e.logsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Logs
                      </a>
                    ) : (
                      <button
                        onClick={() => navigate('/pipelines')}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] text-[11px] text-white/60 hover:text-white transition-colors"
                      >
                        <Terminal className="h-3 w-3" />
                        Inspect
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
};
