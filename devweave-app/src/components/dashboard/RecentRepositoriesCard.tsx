import React from 'react';
import { GitBranch, FolderGit2, ArrowUpRight, Lock, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../ui/GlassCard';
import { recentRepositoriesData } from '../../data/dashboardData';

export const RecentRepositoriesCard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <GlassCard className="flex flex-col justify-between h-full space-y-4 border-white/[0.08]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <FolderGit2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Recent Repositories</h3>
            <p className="text-xs text-white/50">Active codebase branches</p>
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

      <div className="space-y-2">
        {recentRepositoriesData.map((repo) => (
          <div
            key={repo.id}
            onClick={() => navigate('/repositories')}
            className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] hover:border-white/10 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-white/[0.04] text-white/60 group-hover:text-blue-400 transition-colors">
                {repo.visibility === 'private' ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <Globe className="h-3.5 w-3.5" />
                )}
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white group-hover:text-blue-300 transition-colors">
                  {repo.name}
                </h4>
                <div className="flex items-center gap-2 text-[11px] text-white/40 font-mono">
                  <span className="inline-flex items-center gap-1">
                    <GitBranch className="h-3 w-3" />
                    {repo.branch}
                  </span>
                </div>
              </div>
            </div>

            <span className="text-[11px] font-mono text-white/40 group-hover:text-white/70 transition-colors">
              {repo.updatedAt}
            </span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
};
