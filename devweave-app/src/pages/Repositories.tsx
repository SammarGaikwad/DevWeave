import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { githubService } from '../services/githubService';
import type { Repository } from '../types/repository';
import type { GitHubIntegrationStatus } from '../types/integration';
import { RepositoryOverview } from '../components/repository/RepositoryOverview';
import { RepositoryFilters } from '../components/repository/RepositoryFilters';
import type { StatusFilter, SortOption } from '../components/repository/RepositoryFilters';
import { RepositoryCard } from '../components/repository/RepositoryCard';
import { RepositoryListRow } from '../components/repository/RepositoryListRow';
import { ConnectRepositoryModal } from '../components/repository/ConnectRepositoryModal';
import { DisconnectModal } from '../components/repository/DisconnectModal';
import { GitHubConnectionCard } from '../components/repository/GitHubConnectionCard';
import { RepositoryEmptyState } from '../components/repository/RepositoryEmptyState';
import { RepositorySkeleton } from '../components/repository/RepositorySkeleton';
import { RepositoryErrorState } from '../components/repository/RepositoryErrorState';

export const Repositories: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [integrationStatus, setIntegrationStatus] = useState<GitHubIntegrationStatus>({
    status: 'not_connected',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [languageFilter, setLanguageFilter] = useState('All');
  const [sortOption, setSortOption] = useState<SortOption>('Recently Updated');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const isMockMode = import.meta.env.VITE_USE_MOCK_DATA === 'true';

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    // Check query params for GitHub OAuth callback result
    const githubParam = searchParams.get('github');
    if (githubParam === 'error') {
      setError('Unable to connect GitHub. Please try again.');
      setSearchParams({}, { replace: true });
    } else if (githubParam === 'connected') {
      setSearchParams({}, { replace: true });
    }

    try {
      const statusRes = await githubService.getConnectionStatus();

      if (statusRes.connected) {
        setIntegrationStatus({
          status: 'connected',
          connectedAccount: {
            username: statusRes.username || 'github-user',
            avatarUrl: statusRes.avatarUrl,
            connectedAt: statusRes.connectedAt ? new Date(statusRes.connectedAt).toLocaleDateString() : 'Just now',
          },
        });

        const repos = await githubService.getRepositories();
        setRepositories(repos);
      } else {
        setIntegrationStatus({ status: 'not_connected' });
        setRepositories([]);
      }
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message || 'Failed to fetch repositories.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await githubService.disconnectGitHub();
      setIntegrationStatus({ status: 'not_connected' });
      setRepositories([]);
      setIsDisconnectModalOpen(false);
    } catch (err: unknown) {
      alert((err as { message?: string }).message || 'Failed to disconnect GitHub account.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleConnectGitHubSuccess = async () => {
    try {
      await githubService.connectGitHub();
    } catch (err: unknown) {
      alert((err as { message?: string }).message || 'Connection failed.');
    }
  };

  // Calculate Overview Card Statistics
  const totalCount = repositories.length;
  const activeCount = repositories.filter((r) => !r.archived).length;
  const archivedCount = repositories.filter((r) => r.archived).length;
  const recentlyUpdatedCount = repositories.filter(
    (r) => r.updatedAt && (r.updatedAt.includes('min') || r.updatedAt.includes('hour') || r.updatedAt.includes('day'))
  ).length;

  const availableLanguages = useMemo(() => {
    const langs = new Set(repositories.map((r) => r.language).filter(Boolean));
    return Array.from(langs) as string[];
  }, [repositories]);

  const filteredRepositories = useMemo(() => {
    return repositories
      .filter((repo) => {
        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase();
          const matchesName = repo.name?.toLowerCase().includes(q);
          const matchesDesc = repo.description?.toLowerCase().includes(q);
          const matchesLang = repo.language?.toLowerCase().includes(q);
          const matchesOwner = repo.owner?.toLowerCase().includes(q);
          if (!matchesName && !matchesDesc && !matchesLang && !matchesOwner) {
            return false;
          }
        }

        if (statusFilter === 'Active' && repo.archived) return false;
        if (statusFilter === 'Archived' && !repo.archived) return false;
        if (statusFilter === 'Private' && repo.visibility !== 'private' && repo.visibility !== 'PRIVATE') return false;
        if (statusFilter === 'Public' && repo.visibility !== 'public' && repo.visibility !== 'PUBLIC') return false;

        if (languageFilter !== 'All' && repo.language !== languageFilter) return false;

        return true;
      })
      .sort((a, b) => {
        switch (sortOption) {
          case 'Name A-Z':
            return a.name.localeCompare(b.name);
          case 'Name Z-A':
            return b.name.localeCompare(a.name);
          case 'Most Stars':
            return (b.stars || 0) - (a.stars || 0);
          case 'Most Forks':
            return (b.forks || 0) - (a.forks || 0);
          case 'Recently Updated':
          default:
            return 0;
        }
      });
  }, [repositories, searchQuery, statusFilter, languageFilter, sortOption]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setLanguageFilter('All');
    setSortOption('Recently Updated');
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Repositories
          </h1>
          <p className="text-xs sm:text-sm text-white/60">
            Manage and monitor your connected code repositories.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            title="Refresh repository data"
            className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-white/80 hover:text-white transition-all"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
          <button
            onClick={() => setIsConnectModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Connect Repository</span>
          </button>
        </div>
      </div>

      {/* GitHub Integration Status Banner */}
      <GitHubConnectionCard
        status={integrationStatus}
        onConnect={() => setIsConnectModalOpen(true)}
        onDisconnectClick={() => setIsDisconnectModalOpen(true)}
        isMockMode={isMockMode}
      />

      {/* Main Content Area */}
      {integrationStatus.status === 'not_connected' ? (
        <div className="p-12 text-center glass-panel rounded-2xl border-white/[0.08] space-y-4 max-w-xl mx-auto my-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
            <Plus className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">Connect GitHub</h3>
            <p className="text-xs sm:text-sm text-white/60 max-w-md mx-auto">
              Connect your GitHub account to bring your repositories into DevWeave.
            </p>
          </div>
          <button
            onClick={() => githubService.connectGitHub()}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all"
          >
            Connect GitHub
          </button>
        </div>
      ) : isLoading ? (
        <div className="space-y-6">
          <RepositoryOverview total={0} active={0} archived={0} recentlyUpdated={0} />
          <RepositorySkeleton viewMode={viewMode} />
        </div>
      ) : error ? (
        <RepositoryErrorState message={error} onRetry={loadData} />
      ) : (
        <>
          <RepositoryOverview
            total={totalCount}
            active={activeCount}
            archived={archivedCount}
            recentlyUpdated={recentlyUpdatedCount}
          />

          <RepositoryFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            languageFilter={languageFilter}
            onLanguageFilterChange={setLanguageFilter}
            sortOption={sortOption}
            onSortOptionChange={setSortOption}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            availableLanguages={availableLanguages}
          />

          {filteredRepositories.length === 0 ? (
            <RepositoryEmptyState onClearFilters={handleClearFilters} />
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRepositories.map((repo) => (
                <RepositoryCard key={repo.id} repository={repo} />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/[0.08] glass-panel">
              <table className="w-full text-left">
                <thead className="bg-white/[0.02] text-white/40 uppercase text-[11px] font-semibold tracking-wider border-b border-white/[0.08]">
                  <tr>
                    <th className="py-3 px-4">Repository</th>
                    <th className="py-3 px-4">Language</th>
                    <th className="py-3 px-4">Visibility</th>
                    <th className="py-3 px-4">Branch</th>
                    <th className="py-3 px-4">Stats</th>
                    <th className="py-3 px-4">Updated</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredRepositories.map((repo) => (
                    <RepositoryListRow key={repo.id} repository={repo} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <ConnectRepositoryModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onConnectGitHubSuccess={handleConnectGitHubSuccess}
      />

      <DisconnectModal
        isOpen={isDisconnectModalOpen}
        onClose={() => setIsDisconnectModalOpen(false)}
        onConfirm={handleDisconnect}
        isSubmitting={isDisconnecting}
      />
    </div>
  );
};
