import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderGit2,
  GitBranch,
  Star,
  GitFork,
  MoreVertical,
  Lock,
  Globe,
  ExternalLink,
  Workflow,
  Rocket,
  Archive,
} from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { StatusBadge } from '../ui/StatusBadge';
import type { Repository } from '../../types/repository';

interface RepositoryCardProps {
  repository: Repository;
}

export const RepositoryCard: React.FC<RepositoryCardProps> = ({ repository }) => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <GlassCard
      hover={true}
      onClick={() => navigate(`/repositories/${repository.id}`)}
      className="flex flex-col justify-between h-56 border-white/[0.08] relative group"
    >
      <div>
        {/* Top bar: Icon, visibility, status badge, action menu */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
              <FolderGit2 className="h-4 w-4" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white/50 bg-white/[0.04] px-2 py-0.5 rounded border border-white/10">
              {repository.visibility === 'private' ? (
                <Lock className="h-3 w-3" />
              ) : (
                <Globe className="h-3 w-3" />
              )}
              {repository.visibility}
            </span>
            {repository.source && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 font-semibold">
                {repository.source}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2" ref={menuRef} onClick={(e) => e.stopPropagation()}>
            <StatusBadge status={repository.status || 'Active'} size="sm" />
            <button
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-label="Repository options"
              className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {/* Three dot action menu */}
            {isMenuOpen && (
              <div className="absolute right-3 top-10 w-48 rounded-xl glass-panel bg-[#0a0a0a]/95 border border-white/10 shadow-2xl p-1.5 z-30 animate-in fade-in slide-in-from-top-2 duration-150 text-xs">
                <button
                  onClick={() => navigate(`/repositories/${repository.id}`)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-blue-400" />
                  Open Repository
                </button>
                <button
                  onClick={() => navigate(`/repositories/${repository.id}`)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <FolderGit2 className="h-3.5 w-3.5 text-purple-400" />
                  View Details
                </button>
                <button
                  onClick={() => navigate('/pipelines')}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <Workflow className="h-3.5 w-3.5 text-emerald-400" />
                  Configure Pipeline
                </button>
                <button
                  onClick={() => navigate('/deployments')}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <Rocket className="h-3.5 w-3.5 text-amber-400" />
                  View Deployments
                </button>
                <div className="my-1 border-t border-white/10" />
                <button
                  onClick={() => alert(`Archive feature preview for ${repository.name}`)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                >
                  <Archive className="h-3.5 w-3.5" />
                  Archive Repository
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Repository Name & Description */}
        <h3 className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors truncate">
          {repository.name}
        </h3>
        <p className="text-xs text-white/50 mt-1 line-clamp-2 leading-relaxed">
          {repository.description}
        </p>
      </div>

      {/* Footer Info: Language, Stars, Forks, Updated time */}
      <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-white/40 font-mono">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-white/70">{repository.language}</span>
          <span className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            {repository.defaultBranch}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 text-amber-400" />
            {repository.stars}
          </span>
          <span className="flex items-center gap-1">
            <GitFork className="h-3 w-3" />
            {repository.forks}
          </span>
        </div>
      </div>
    </GlassCard>
  );
};
