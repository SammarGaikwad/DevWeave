import React from 'react';
import { FolderGit2, ShieldAlert, LogOut, ArrowRight, RefreshCw } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import type { GitHubIntegrationStatus } from '../../types/integration';

interface GitHubConnectionCardProps {
  status: GitHubIntegrationStatus;
  onConnect: () => void;
  onDisconnectClick: () => void;
  isMockMode?: boolean;
}

export const GitHubConnectionCard: React.FC<GitHubConnectionCardProps> = ({
  status,
  onConnect,
  onDisconnectClick,
  isMockMode = true,
}) => {
  const isConnected = status.status === 'connected';
  const isConnecting = status.status === 'connecting';
  const isError = status.status === 'error';

  return (
    <GlassCard className="p-5 border-white/[0.08] relative overflow-hidden bg-gradient-to-r from-blue-950/20 via-transparent to-transparent">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Section: Provider Info & Status */}
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 shrink-0">
            <FolderGit2 className="h-6 w-6" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold text-white tracking-tight">GitHub Integration</h3>

              {isConnected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
                  </span>
                  Connected
                </span>
              ) : isConnecting ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Connecting...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/30">
                  Not Connected
                </span>
              )}

              {/* Mode badge */}
              <span className="text-[10px] uppercase font-bold text-white/40 bg-white/[0.04] border border-white/10 px-2 py-0.5 rounded-full">
                {isMockMode ? 'Demo Data' : 'GitHub Connected'}
              </span>
            </div>

            {isConnected && status.connectedAccount ? (
              <p className="text-xs text-white/70">
                Connected account:{' '}
                <span className="font-semibold text-blue-300">
                  @{status.connectedAccount.username}
                </span>{' '}
                <span className="text-white/40 font-mono text-[11px]">
                  ({status.connectedAccount.connectedAt})
                </span>
              </p>
            ) : isError ? (
              <p className="text-xs text-rose-400 flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5" />
                {status.errorMessage || 'GitHub API rate limit or connection error.'}
              </p>
            ) : (
              <p className="text-xs text-white/50">
                Connect your GitHub organization or personal account to manage code repositories.
              </p>
            )}
          </div>
        </div>

        {/* Right Section: Action Button */}
        <div className="flex items-center gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/[0.06]">
          {isConnected ? (
            <button
              onClick={onDisconnectClick}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition-all"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Disconnect</span>
            </button>
          ) : (
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all group"
            >
              <span>Connect GitHub</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      </div>
    </GlassCard>
  );
};
