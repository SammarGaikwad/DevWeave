import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  GitBranch,
  Star,
  GitFork,
  AlertCircle,
  GitPullRequest,
  Workflow,
  Rocket,
  ChevronRight,
  Lock,
  Globe,
  ExternalLink,
  Copy,
  GitCommit,
  ArrowUpRight,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { githubService } from '../services/githubService';
import { mockRepositories, mockBranches, mockCommits, mockPullRequests } from '../data/repositories';
import type { Repository, BranchInfo, CommitInfo, PullRequestInfo } from '../types/repository';
import { GlassCard } from '../components/ui/GlassCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { RepositoryWorkspace } from '../components/workspace/RepositoryWorkspace';

export const RepositoryDetails: React.FC = () => {
  const { repositoryId } = useParams<{ repositoryId: string }>();
  const navigate = useNavigate();

  const [repo, setRepo] = useState<Repository | null>(null);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [pullRequests, setPullRequests] = useState<PullRequestInfo[]>([]);
  const [isGithubConnected, setIsGithubConnected] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMockMode = import.meta.env.VITE_USE_MOCK_DATA === 'true';

  useEffect(() => {
    const loadDetails = async () => {
      if (!repositoryId) return;
      setIsLoading(true);
      setError(null);

      try {
        if (isMockMode) {
          const mockR = mockRepositories.find((r) => r.id === repositoryId);
          if (mockR) {
            setRepo(mockR);
            setBranches(mockBranches[mockR.id] || []);
            setCommits(mockCommits[mockR.id] || []);
            setPullRequests(mockPullRequests[mockR.id] || []);
            setIsGithubConnected(true);
          } else {
            setError('Repository not found');
          }
        } else {
          // Real DevWeave Backend integration
          const connStatus = await githubService.getConnectionStatus().catch(() => ({ connected: false }));
          setIsGithubConnected(Boolean(connStatus?.connected));

          const fetchedRepo = await githubService.getRepository(repositoryId);
          if (fetchedRepo) {
            setRepo(fetchedRepo);

            // Fetch branches, commits, PRs in parallel
            const [bList, cList, pList] = await Promise.all([
              githubService.getBranches(repositoryId).catch(() => []),
              githubService.getCommits(repositoryId).catch(() => []),
              githubService.getPullRequests(repositoryId).catch(() => []),
            ]);

            setBranches(
              bList.length > 0
                ? bList
                : [
                    {
                      name: fetchedRepo.defaultBranch || 'main',
                      lastCommit: 'Initial commit',
                      updatedAt: 'Recently',
                      isDefault: true,
                    },
                  ]
            );
            setCommits(cList);
            setPullRequests(pList);
          } else {
            setError('Repository not found');
          }
        }
      } catch (err: unknown) {
        setError((err as { message?: string }).message || 'Failed to fetch repository details.');
      } finally {
        setIsLoading(false);
      }
    };

    loadDetails();
  }, [repositoryId, isMockMode]);


  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-white">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
        <p className="text-xs text-white/50 font-medium">Loading repository details from GitHub...</p>
      </div>
    );
  }

  if (error || !repo) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/repositories')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Repositories
        </button>
        <GlassCard className="p-10 text-center space-y-4 max-w-md mx-auto my-12">
          <AlertCircle className="h-10 w-10 text-rose-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Repository Not Found</h2>
          <p className="text-xs text-white/60">
            {error || `The requested repository "${repositoryId}" could not be located.`}
          </p>
          <button
            onClick={() => navigate('/repositories')}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold"
          >
            Return to Repositories List
          </button>
        </GlassCard>
      </div>
    );
  }

  const handleClone = () => {
    const cloneUrl = repo.fullName
      ? `git clone https://github.com/${repo.fullName}.git`
      : `git clone https://github.com/${repo.owner}/${repo.name}.git`;
    navigator.clipboard.writeText(cloneUrl);
    alert(`Copied git clone command to clipboard:\n${cloneUrl}`);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Breadcrumbs Header */}
      <div className="space-y-3">
        <nav className="flex items-center gap-2 text-xs font-medium text-white/50">
          <Link to="/dashboard" className="hover:text-white transition-colors">
            DevWeave
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-white/20" />
          <Link to="/repositories" className="hover:text-white transition-colors">
            Repositories
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-white/20" />
          <span className="text-white font-semibold">{repo.name}</span>
        </nav>

        {/* Header Main info & action buttons */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                {repo.name}
              </h1>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-white/60 bg-white/[0.04] px-2.5 py-0.5 rounded-md border border-white/10">
                {repo.visibility === 'private' || repo.visibility === 'PRIVATE' ? (
                  <Lock className="h-3 w-3" />
                ) : (
                  <Globe className="h-3 w-3" />
                )}
                {repo.visibility}
              </span>
              {repo.language && (
                <span className="text-xs font-mono font-medium text-blue-300 bg-blue-500/10 px-2.5 py-0.5 rounded-md border border-blue-500/20">
                  {repo.language}
                </span>
              )}
              <StatusBadge status={repo.status || 'Active'} />
            </div>
            <p className="text-xs sm:text-sm text-white/60 max-w-2xl">
              {repo.description || 'No description provided for this repository.'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleClone}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-white text-xs font-semibold transition-all"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Clone</span>
            </button>

            <a
              href={`https://github.com/${repo.fullName || `${repo.owner}/${repo.name}`}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-white text-xs font-semibold transition-all"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Open on GitHub</span>
            </a>

            <button
              onClick={() => navigate('/pipelines')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all"
            >
              <Workflow className="h-3.5 w-3.5" />
              <span>Configure Pipeline</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Metrics Row */}
      <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <GlassCard className="p-4 border-white/[0.08] flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                Stars
              </p>
              <p className="text-xl sm:text-2xl font-mono font-bold text-white tracking-tight mt-0.5">
                {repo.stars || 0}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Star className="h-5 w-5" />
            </div>
          </GlassCard>

          <GlassCard className="p-4 border-white/[0.08] flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                Forks
              </p>
              <p className="text-xl sm:text-2xl font-mono font-bold text-white tracking-tight mt-0.5">
                {repo.forks || 0}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <GitFork className="h-5 w-5" />
            </div>
          </GlassCard>

          <GlassCard className="p-4 border-white/[0.08] flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                Branches
              </p>
              <p className="text-xl sm:text-2xl font-mono font-bold text-white tracking-tight mt-0.5">
                {branches.length}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <GitBranch className="h-5 w-5" />
            </div>
          </GlassCard>

          <GlassCard className="p-4 border-white/[0.08] flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                Pull Requests
              </p>
              <p className="text-xl sm:text-2xl font-mono font-bold text-white tracking-tight mt-0.5">
                {pullRequests.length}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <GitPullRequest className="h-5 w-5" />
            </div>
          </GlassCard>
        </div>
      </div>

      {/* CI/CD & Deployment Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard className="p-5 flex flex-col justify-between space-y-4 border-white/[0.08]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Workflow className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Pipeline Integration</h3>
                <p className="text-xs text-white/50">CI/CD automation runner</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold border bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
              Not Connected
            </span>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
            <span className="text-xs text-white/60">
              No CI/CD pipeline linked to this repository yet.
            </span>
            <button
              onClick={() => navigate('/pipelines')}
              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-semibold"
            >
              Configure Pipeline
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </GlassCard>

        <GlassCard className="p-5 flex flex-col justify-between space-y-4 border-white/[0.08]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Rocket className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Latest Deployment</h3>
                <p className="text-xs text-white/50">Production / Staging status</p>
              </div>
            </div>
            <span className="text-xs text-white/40 bg-white/[0.04] px-2.5 py-0.5 rounded border border-white/10">
              No Deployments
            </span>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
            <span className="text-xs text-white/60">
              Deployments will appear after linking a release pipeline.
            </span>
            <button
              onClick={() => navigate('/deployments')}
              className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 font-semibold"
            >
              View Deployment
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </GlassCard>
      </div>

      {/* GitHub Repository Workspace Section */}
      <RepositoryWorkspace
        repository={repo}
        branches={branches}
        isGithubConnected={isGithubConnected}
        onConnectGithub={() => githubService.connectGitHub()}
        onCommitSuccess={async () => {
          if (repositoryId) {
            const updatedCommits = await githubService.getCommits(repositoryId).catch(() => []);
            setCommits(updatedCommits);
          }
        }}
      />

      {/* Main 2-Column Section: Left (Branches & Commits), Right (Pull Requests) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="lg:col-span-2 space-y-6">
          {/* Branch Information */}
          <GlassCard className="space-y-4 border-white/[0.08]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-white">Branches</h3>
              </div>
              <span className="text-xs font-mono text-white/40">{branches.length} branches</span>
            </div>

            <div className="space-y-2">
              {branches.map((b) => (
                <div
                  key={b.name}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono text-xs font-semibold text-white">{b.name}</span>
                    {b.protected && (
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded border border-blue-500/30 font-semibold">
                        Protected
                      </span>
                    )}
                    {b.commitSha && (
                      <span className="hidden sm:inline text-xs font-mono text-white/40 truncate">
                        • {b.commitSha.substring(0, 7)}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-white/40 shrink-0">
                    {b.updatedAt || 'Latest'}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Recent Commits */}
          <GlassCard className="space-y-4 border-white/[0.08]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitCommit className="h-4 w-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">Recent Commits</h3>
              </div>
              <span className="text-xs font-mono text-white/40">History</span>
            </div>

            <div className="space-y-2.5">
              {commits.length === 0 ? (
                <p className="text-xs text-white/40 p-2">No commit history available.</p>
              ) : (
                commits.map((c) => (
                  <div
                    key={c.sha || c.hash}
                    className="flex items-start justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                  >
                    <div className="space-y-1 min-w-0 pr-3">
                      <p className="text-xs font-semibold text-white truncate">{c.message}</p>
                      <div className="flex items-center gap-2 text-[11px] text-white/40">
                        <span className="font-medium text-white/70">{c.author}</span>
                        {c.timestamp && (
                          <>
                            <span>•</span>
                            <span>{new Date(c.timestamp).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 shrink-0">
                      #{(c.sha || c.hash || '').substring(0, 7)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <GlassCard className="space-y-4 border-white/[0.08]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitPullRequest className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Pull Requests</h3>
              </div>
              <span className="text-xs font-mono text-white/40">{pullRequests.length} PRs</span>
            </div>

            <div className="space-y-3">
              {pullRequests.length === 0 ? (
                <p className="text-xs text-white/40 p-2">No pull requests found.</p>
              ) : (
                pullRequests.map((pr) => (
                  <div
                    key={pr.number}
                    className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-white line-clamp-2">
                        #{pr.number} {pr.title}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                          pr.state === 'OPEN' || pr.status === 'Open'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : pr.state === 'MERGED' || pr.status === 'Merged'
                            ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                            : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                        }`}
                      >
                        {pr.state || pr.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-white/40 font-mono pt-1 border-t border-white/[0.04]">
                      <span>By {pr.author}</span>
                      <span>{pr.createdAt ? new Date(pr.createdAt).toLocaleDateString() : ''}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};
