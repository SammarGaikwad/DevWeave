import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
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
  FolderGit2,
} from 'lucide-react';
import { StatusBadge } from '../ui/StatusBadge';
import type { Repository } from '../../types/repository';

interface RepositoryListRowProps {
  repository: Repository;
}

export const RepositoryListRow: React.FC<RepositoryListRowProps> = ({ repository }) => {
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
    <tr
      onClick={() => navigate(`/repositories/${repository.id}`)}
      className="group hover:bg-white/[0.03] transition-colors cursor-pointer border-b border-white/[0.04]"
    >
      {/* Name & Description */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white/[0.04] border border-white/10 text-blue-400 group-hover:bg-blue-500/10 group-hover:border-blue-500/30 transition-all shrink-0">
            <FolderGit2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 max-w-xs sm:max-w-md">
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-semibold text-white group-hover:text-blue-300 transition-colors truncate">
                {repository.name}
              </h4>
              {repository.source && (
                <span className="text-[10px] font-mono text-blue-300 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.2 rounded font-semibold">
                  {repository.source}
                </span>
              )}
              {repository.archived && (
                <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.2 rounded">
                  Archived
                </span>
              )}
            </div>
            <p className="text-[11px] text-white/50 truncate mt-0.5">
              {repository.description}
            </p>
          </div>
        </div>
      </td>

      {/* Language */}
      <td className="py-3.5 px-4 font-mono text-xs text-white/80 font-medium whitespace-nowrap">
        {repository.language}
      </td>

      {/* Visibility */}
      <td className="py-3.5 px-4 whitespace-nowrap">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white/50 bg-white/[0.04] px-2 py-0.5 rounded border border-white/10">
          {repository.visibility === 'private' ? (
            <Lock className="h-3 w-3" />
          ) : (
            <Globe className="h-3 w-3" />
          )}
          {repository.visibility}
        </span>
      </td>

      {/* Branch */}
      <td className="py-3.5 px-4 font-mono text-xs text-white/60 whitespace-nowrap">
        <span className="inline-flex items-center gap-1">
          <GitBranch className="h-3 w-3 text-white/30" />
          {repository.defaultBranch}
        </span>
      </td>

      {/* Stars & Forks */}
      <td className="py-3.5 px-4 font-mono text-xs text-white/50 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Star className="h-3 w-3 text-amber-400" />
            {repository.stars}
          </span>
          <span className="inline-flex items-center gap-1">
            <GitFork className="h-3 w-3 text-white/40" />
            {repository.forks}
          </span>
        </div>
      </td>

      {/* Last Updated */}
      <td className="py-3.5 px-4 font-mono text-xs text-white/40 whitespace-nowrap">
        {repository.updatedAt}
      </td>

      {/* Status */}
      <td className="py-3.5 px-4 whitespace-nowrap">
        <StatusBadge status={repository.status || 'Active'} size="sm" />
      </td>

      {/* Action Menu Column */}
      <td className="py-3.5 px-4 text-right whitespace-nowrap relative" onClick={(e) => e.stopPropagation()}>
        <div ref={menuRef} className="inline-block">
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label="Repository menu"
            className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-4 top-10 w-48 rounded-xl glass-panel bg-[#0a0a0a]/95 border border-white/10 shadow-2xl p-1.5 z-30 animate-in fade-in slide-in-from-top-2 duration-150 text-left text-xs">
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
      </td>
    </tr>
  );
};
