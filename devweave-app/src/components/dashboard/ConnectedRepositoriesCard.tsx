import React from 'react';
import { FolderGit2, ArrowUpRight, GitBranch, Lock, Globe, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../ui/GlassCard';
import type { RecentRepositoryItem } from '../../types/dashboard';

interface ConnectedRepositoriesCardProps {
  repositories: RecentRepositoryItem[];
  isGithubConnected: boolean;
  githubUsername: string | null;
  totalAccessible: number;
}

export const ConnectedRepositoriesCard: React.FC<ConnectedRepositoriesCardProps> = ({
  repositories,
  isGithubConnected,
  githubUsername,
  totalAccessible,
}) => {
  const navigate = useNavigate();

  return (
    <GlassCard className="flex flex-col justify-between space-y-4 border-white/[0.08] p-5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <FolderGit2 className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">Repository Overview</h3>
              {isGithubConnected && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  @{githubUsername}
                </span>
              )}
            </div>
            <p className="text-xs text-white/50">{totalAccessible} accessible repositories</p>
          </div>
        </div>

        <button
          onClick={() => navigate('/repositories')}
          className="text-xs text-white/50 hover:text-white inline-flex items-center gap-1 transition-colors"
        >
          View All
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Repositories List */}
      {repositories.length === 0 ? (
        <div className="py-8 text-center rounded-xl border border-dashed border-white/10 bg-white/[0.01] space-y-2">
          <FolderGit2 className="h-8 w-8 text-white/20 mx-auto" />
          <p className="text-xs font-medium text-white/60">No connected repositories found.</p>
          <p className="text-[11px] text-white/40 max-w-xs mx-auto">
            {isGithubConnected
              ? 'No repositories found in your linked GitHub account.'
              : 'Link your GitHub account or create a repository in DevWeave to get started.'}
          </p>
          <button
            onClick={() => navigate('/repositories')}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-medium hover:bg-blue-600/30 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            {isGithubConnected ? 'Manage Repositories' : 'Connect GitHub'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {repositories.map((repo) => (
            <div
              key={repo.id}
              onClick={() => navigate('/repositories')}
              className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] hover:border-white/10 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-white/[0.04] text-white/50 group-hover:text-blue-400 transition-colors shrink-0">
                  {repo.visibility.toLowerCase() === 'private' ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : (
                    <Globe className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-white group-hover:text-blue-300 transition-colors truncate">
                    {repo.name}
                  </h4>
                  <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono">
                    <span className="inline-flex items-center gap-1">
                      <GitBranch className="h-2.5 w-2.5" />
                      {repo.defaultBranch}
                    </span>
                    <span className="text-white/20">•</span>
                    <span className="uppercase">{repo.source}</span>
                  </div>
                </div>
              </div>

              <span className="text-[10px] font-mono text-white/40 group-hover:text-white/70 transition-colors shrink-0 pl-2">
                {repo.updatedAt ? new Date(repo.updatedAt).toLocaleDateString() : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
};
