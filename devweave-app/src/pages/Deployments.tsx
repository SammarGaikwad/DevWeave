import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Rocket,
  CheckCircle2,
  History,
  RotateCcw,
  ArrowRight,
  Clock,
  Layers,
  RefreshCw,
  GitCommit,
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  Info,
  X,
  Copy,
  Check,
  Terminal,
  Activity,
  Eye,
  Server,
  Radio,
  FileText,
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { StatusBadge, type StatusType } from '../components/ui/StatusBadge';
import {
  deploymentService,
  type EnvironmentSummary,
  type EnvironmentDetail,
  type DeploymentExecutionRecord,
} from '../services/deploymentService';
import { githubService } from '../services/githubService';
import type { Repository, BranchInfo } from '../types/repository';

export const Deployments: React.FC = () => {
  const navigate = useNavigate();

  // Core data states
  const [environments, setEnvironments] = useState<EnvironmentSummary[]>([]);
  const [history, setHistory] = useState<DeploymentExecutionRecord[]>([]);
  const [totalHistory, setTotalHistory] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [pageError, setPageError] = useState<string | null>(null);

  // History filtering
  const [historyEnvFilter, setHistoryEnvFilter] = useState<string>('All');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('All');

  // Detail Modal State
  const [selectedEnvDetail, setSelectedEnvDetail] = useState<EnvironmentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Deploy Modal State
  const [showDeployModal, setShowDeployModal] = useState<boolean>(false);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [targetEnv, setTargetEnv] = useState<'Production' | 'Staging' | 'Development'>('Development');
  const [deployStrategy, setDeployStrategy] = useState<string>('RollingUpdate');
  const [deploying, setDeploying] = useState<boolean>(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deploySuccess, setDeploySuccess] = useState<DeploymentExecutionRecord | null>(null);

  // Rollback Modal State
  const [rollbackEnv, setRollbackEnv] = useState<EnvironmentSummary | null>(null);
  const [rollbackReason, setRollbackReason] = useState<string>('');
  const [rollingBack, setRollingBack] = useState<boolean>(false);
  const [rollbackError, setRollbackError] = useState<string | null>(null);
  const [rollbackSuccessMsg, setRollbackSuccessMsg] = useState<string | null>(null);

  // Logs Modal State
  const [viewingLogsRecord, setViewingLogsRecord] = useState<DeploymentExecutionRecord | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 1. Fetch environments and history
  const fetchData = useCallback(async (forceProbe = false) => {
    setRefreshing(true);
    setPageError(null);
    try {
      const [envs, histData] = await Promise.all([
        deploymentService.getEnvironments(forceProbe),
        deploymentService.getDeploymentHistory({
          environment: historyEnvFilter,
          status: historyStatusFilter,
          limit: 15,
        }),
      ]);
      setEnvironments(envs);
      setHistory(histData.items);
      setTotalHistory(histData.total);
      setLastRefreshed(new Date());
    } catch (err: any) {
      console.error('Failed to load deployment data:', err);
      setPageError(
        err?.response?.data?.message || err?.message || 'Failed to communicate with deployment service.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [historyEnvFilter, historyStatusFilter]);

  useEffect(() => {
    void fetchData(false);
  }, [fetchData]);

  // Load repositories when deploy modal opens
  useEffect(() => {
    if (showDeployModal && repositories.length === 0) {
      githubService
        .getRepositories()
        .then((repos) => {
          setRepositories(repos);
          if (repos.length > 0) {
            setSelectedRepoId(repos[0].id);
          }
        })
        .catch((err) => {
          console.warn('Could not fetch repositories for deployment modal', err);
        });
    }
  }, [showDeployModal, repositories.length]);

  // Load branches when selected repository changes
  useEffect(() => {
    if (selectedRepoId) {
      githubService
        .getBranches(selectedRepoId)
        .then((branchList) => {
          setBranches(branchList);
          if (branchList.length > 0) {
            const defaultB = branchList.find((b) => b.isDefault)?.name || branchList[0].name;
            setSelectedBranch(defaultB);
          } else {
            setSelectedBranch('main');
          }
        })
        .catch(() => {
          setBranches([]);
          setSelectedBranch('main');
        });
    }
  }, [selectedRepoId]);

  // Open Environment Detail Modal
  const handleOpenDetail = async (env: EnvironmentSummary) => {
    setLoadingDetail(true);
    setSelectedEnvDetail(null);
    try {
      const detail = await deploymentService.getEnvironmentDetails(env.id);
      setSelectedEnvDetail(detail);
    } catch (err: any) {
      console.error('Could not load environment detail', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Open Rollback Modal
  const handleOpenRollback = (env: EnvironmentSummary) => {
    setRollbackEnv(env);
    setRollbackReason('');
    setRollbackError(null);
  };

  // Submit Rollback
  const handleConfirmRollback = async () => {
    if (!rollbackEnv) return;
    setRollingBack(true);
    setRollbackError(null);
    try {
      const res = await deploymentService.rollbackDeployment(rollbackEnv.id, {
        reason: rollbackReason.trim() || undefined,
      });
      setRollbackSuccessMsg(res.message);
      setRollbackEnv(null);
      setTimeout(() => setRollbackSuccessMsg(null), 6000);
      void fetchData(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Rollback execution failed.';
      setRollbackError(msg);
    } finally {
      setRollingBack(false);
    }
  };

  // Submit Deployment via Pipeline
  const handleConfirmDeploy = async () => {
    if (!selectedBranch.trim()) {
      setDeployError('Please specify or select a branch to deploy.');
      return;
    }
    setDeploying(true);
    setDeployError(null);
    try {
      const selectedRepo = repositories.find((r) => r.id === selectedRepoId);
      const record = await deploymentService.triggerDeployment({
        environment: targetEnv,
        repositoryId: selectedRepoId || undefined,
        repositoryName: selectedRepo?.name || 'DevWeave-Core',
        branch: selectedBranch.trim(),
        strategy: deployStrategy,
      });
      setDeploySuccess(record);
      void fetchData(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Deployment trigger failed.';
      setDeployError(msg);
    } finally {
      setDeploying(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Map truthful status to badge variant
  const getBadgeType = (status: EnvironmentSummary['status']): StatusType => {
    switch (status) {
      case 'Healthy':
        return 'Healthy';
      case 'Deploying':
        return 'Pending';
      case 'Degraded':
        return 'Warning';
      case 'Failed':
        return 'Failed';
      case 'Not configured':
      case 'Unknown':
      default:
        return 'Offline';
    }
  };

  // Environment metrics summary
  const healthyCount = useMemo(
    () => environments.filter((e) => e.status === 'Healthy').length,
    [environments]
  );
  const configuredCount = useMemo(
    () => environments.filter((e) => e.status !== 'Not configured').length,
    [environments]
  );

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300 font-sans">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <Rocket className="h-7 w-7 text-blue-400 shrink-0" />
              <span>Environment Deployments</span>
            </h1>
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/30 flex items-center space-x-1.5">
              <Radio className="w-3 h-3 text-blue-400 shrink-0 animate-pulse" />
              <span>
                {configuredCount} Configured • {healthyCount} Healthy
              </span>
            </span>
          </div>
          <p className="text-sm text-white/60 mt-1">
            Monitor releases, manage environments, and track deployment health.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[11px] text-white/40 hidden sm:inline font-mono">
            Refreshed {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>

          <button
            onClick={() => void fetchData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/80 hover:text-white hover:bg-white/[0.08] text-xs font-medium transition-all disabled:opacity-50"
            title="Probe live health and refresh environment state"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => {
              setShowDeployModal(true);
              setDeploySuccess(null);
              setDeployError(null);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Rocket className="h-4 w-4" />
            <span>Deploy via Pipeline</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {rollbackSuccessMsg && (
        <GlassCard className="p-4 border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between text-xs text-emerald-300 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{rollbackSuccessMsg}</span>
          </div>
          <button
            onClick={() => setRollbackSuccessMsg(null)}
            className="text-emerald-400 hover:text-emerald-200"
          >
            <X className="w-4 h-4" />
          </button>
        </GlassCard>
      )}

      {pageError && (
        <GlassCard className="p-4 border-rose-500/30 bg-rose-500/10 flex items-center justify-between text-xs text-rose-300 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{pageError}</span>
          </div>
          <button
            onClick={() => void fetchData(false)}
            className="px-2.5 py-1 text-xs bg-rose-500/20 hover:bg-rose-500/30 rounded-lg text-rose-200 transition"
          >
            Retry
          </button>
        </GlassCard>
      )}

      {/* 2. Environment Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading
          ? [1, 2, 3].map((i) => (
              <GlassCard key={i} className="p-6 space-y-4 animate-pulse">
                <div className="h-6 w-32 bg-white/[0.08] rounded-md" />
                <div className="h-4 w-20 bg-white/[0.04] rounded-md" />
                <div className="h-16 bg-white/[0.02] rounded-xl" />
                <div className="h-8 bg-white/[0.04] rounded-xl" />
              </GlassCard>
            ))
          : environments.map((env) => (
              <GlassCard
                key={env.id}
                className="p-6 space-y-4 flex flex-col justify-between hover:border-white/[0.15] transition-all group"
              >
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors">
                          {env.name}
                        </h3>
                        {env.requiresApproval && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium"
                            title="Approval required for production deployments"
                          >
                            Protected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/50 mt-1 font-mono flex items-center gap-1.5">
                        <span>Strategy: {env.strategy}</span>
                      </p>
                    </div>

                    <StatusBadge
                      status={getBadgeType(env.status)}
                      customLabel={env.status}
                      size="sm"
                    />
                  </div>

                  {/* Card Telemetry Details */}
                  <div className="space-y-2.5 text-xs">
                    {/* Release Version */}
                    <div className="flex items-center justify-between text-white/70">
                      <span className="text-white/40">Active Release:</span>
                      <span className="font-mono text-white/90 font-semibold">
                        {env.version || <span className="text-white/40 italic">None deployed</span>}
                      </span>
                    </div>

                    {/* Active Commit */}
                    <div className="space-y-1">
                      <span className="text-white/40 block text-[11px]">Active Commit:</span>
                      {env.commitSha ? (
                        <div className="flex items-center justify-between gap-1.5 text-white/80 font-mono text-[11px] bg-white/[0.02] p-2 rounded-lg border border-white/[0.04]">
                          <div className="flex items-center gap-1.5 min-w-0 truncate">
                            <GitCommit className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                            <span className="text-blue-300 font-semibold">{env.commitSha.substring(0, 7)}</span>
                            <span className="truncate text-white/60">
                              {env.commitMessage || 'Automated promotion'}
                            </span>
                          </div>
                          <button
                            onClick={() => handleCopy(env.commitSha!, `commit-${env.id}`)}
                            className="p-1 hover:text-white text-white/40 transition shrink-0"
                            title="Copy full commit SHA"
                          >
                            {copiedKey === `commit-${env.id}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-white/40 italic text-[11px]">
                          No deployment recorded yet
                        </div>
                      )}
                    </div>

                    {/* Workload / Replicas */}
                    <div className="flex items-center justify-between text-white/60 pt-1">
                      <span className="inline-flex items-center gap-1.5 text-white/50">
                        <Layers className="h-3.5 w-3.5 text-indigo-400" /> Pod Readiness:
                      </span>
                      <span className="font-mono text-emerald-400 font-medium">
                        {env.replicas || <span className="text-white/40 italic">No pods active</span>}
                      </span>
                    </div>

                    {/* Deployed Timestamp */}
                    <div className="flex items-center justify-between text-white/60">
                      <span className="inline-flex items-center gap-1.5 text-white/50">
                        <Clock className="h-3.5 w-3.5 text-amber-400" /> Last Deployed:
                      </span>
                      <span className="text-white/80">
                        {env.deployedAt ? new Date(env.deployedAt).toLocaleDateString() : 'Never'}
                      </span>
                    </div>

                    {/* Diagnostic message */}
                    <div className="p-2 rounded-lg bg-white/[0.02] text-[11px] text-white/60 flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{env.healthMessage}</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {env.url ? (
                      <a
                        href={env.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        title={`Open live endpoint: ${env.url}`}
                      >
                        <span>Live URL</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-white/40 italic">No public URL</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => void handleOpenDetail(env)}
                      disabled={loadingDetail}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/80 hover:text-white text-xs font-medium transition-all flex items-center gap-1 disabled:opacity-50"
                    >
                      {loadingDetail ? (
                        <RefreshCw className="w-3 h-3 text-indigo-400 animate-spin" />
                      ) : (
                        <Eye className="w-3 h-3 text-indigo-400" />
                      )}
                      <span>Details</span>
                    </button>

                    <button
                      onClick={() => handleOpenRollback(env)}
                      disabled={!env.isRollbackSupported}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-40 disabled:hover:bg-transparent text-white/80 hover:text-white text-xs font-medium transition-all"
                      title={
                        env.isRollbackSupported
                          ? 'Rollback to previous verified deployment'
                          : 'Rollback requires at least two recorded deployments or a live cluster workload'
                      }
                    >
                      <RotateCcw className="h-3 w-3 text-amber-400" />
                      <span>Rollback</span>
                    </button>
                  </div>
                </div>
              </GlassCard>
            ))}
      </div>

      {/* 3. Recent Release & Deployment Executions */}
      <GlassCard className="p-6 space-y-4">
        {/* History Header & Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <History className="h-4 w-4 text-blue-400" />
                <span>Recent Release & Deployment Executions</span>
              </h3>
              {totalHistory > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  {history.length} of {totalHistory}
                </span>
              )}
            </div>
            <p className="text-xs text-white/50 mt-0.5">
              Verified deployment executions, promotion audit trails, and execution logs.
            </p>
          </div>

          {/* Filter Toolbar */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Environment Filter */}
            <div className="flex items-center space-x-1 bg-white/[0.04] p-1 rounded-lg border border-white/[0.06]">
              <span className="text-[11px] text-white/40 px-1.5">Env:</span>
              {['All', 'Production', 'Staging', 'Development'].map((env) => (
                <button
                  key={env}
                  onClick={() => setHistoryEnvFilter(env)}
                  className={`px-2 py-0.5 rounded text-[11px] transition ${
                    historyEnvFilter === env
                      ? 'bg-blue-600 text-white font-medium'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {env}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-1 bg-white/[0.04] p-1 rounded-lg border border-white/[0.06]">
              <span className="text-[11px] text-white/40 px-1.5">Status:</span>
              {['All', 'SUCCESS', 'RUNNING', 'FAILED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setHistoryStatusFilter(st)}
                  className={`px-2 py-0.5 rounded text-[11px] transition ${
                    historyStatusFilter === st
                      ? 'bg-blue-600 text-white font-medium'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <button
              onClick={() => navigate('/pipelines')}
              className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 pl-2"
            >
              <span>Pipelines</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* History List */}
        <div className="space-y-2">
          {history.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mx-auto text-white/40">
                <Rocket className="w-6 h-6 text-white/30" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-white/80">No deployment executions found</h4>
                <p className="text-xs text-white/50 max-w-sm mx-auto">
                  No deployment runs match your current filter. Trigger a deployment using the{' '}
                  <strong className="text-white">Deploy via Pipeline</strong> action above.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDeployModal(true);
                  setDeploySuccess(null);
                  setDeployError(null);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs text-white/80 border border-white/[0.08] transition inline-flex items-center gap-1.5"
              >
                <Rocket className="w-3.5 h-3.5 text-blue-400" />
                <span>Start First Deployment</span>
              </button>
            </div>
          ) : (
            history.map((record) => (
              <div
                key={record.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      record.status === 'SUCCESS'
                        ? 'bg-emerald-400 shadow-sm shadow-emerald-500/50'
                        : record.status === 'RUNNING'
                        ? 'bg-blue-400 animate-ping'
                        : 'bg-rose-400'
                    }`}
                  />
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-white font-mono">
                        {record.repositoryName} • {record.branch}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/70 font-medium">
                        {record.environment}
                      </span>
                      {record.triggerSource === 'ROLLBACK' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
                          Rollback
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/50 truncate">
                      {record.commitMessage || 'Promote release'} •{' '}
                      {new Date(record.startedAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto text-xs font-mono">
                  {record.durationMs && (
                    <span className="text-white/50 text-[11px]">
                      {Math.round(record.durationMs / 1000)}s
                    </span>
                  )}

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      record.status === 'SUCCESS'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : record.status === 'RUNNING'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {record.status}
                  </span>

                  {record.logs && (
                    <button
                      onClick={() => setViewingLogsRecord(record)}
                      className="px-2 py-1 text-[11px] font-sans bg-white/[0.04] hover:bg-white/[0.08] text-white/80 hover:text-white rounded-lg transition flex items-center gap-1"
                      title="View deployment logs"
                    >
                      <FileText className="w-3 h-3 text-blue-400" />
                      <span>Logs</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </GlassCard>

      {/* 4. Deploy via Pipeline Modal */}
      {showDeployModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-xl p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Rocket className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Deploy via Pipeline</h3>
                  <p className="text-xs text-slate-400">Configure target environment and promote verified code.</p>
                </div>
              </div>
              <button
                onClick={() => setShowDeployModal(false)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {deploySuccess ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Deployment Successfully Executed!</span>
                </div>
                <div className="text-xs text-slate-300 space-y-1 font-mono">
                  <div>Environment: {deploySuccess.environment}</div>
                  <div>Branch: {deploySuccess.branch}</div>
                  <div>Commit SHA: {deploySuccess.commitSha}</div>
                  <div>Status: {deploySuccess.status}</div>
                </div>
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setShowDeployModal(false)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {deployError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{deployError}</span>
                  </div>
                )}

                {/* Target Environment Selector */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                    1. Target Environment:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Development', 'Staging', 'Production'] as const).map((env) => (
                      <button
                        key={env}
                        type="button"
                        onClick={() => setTargetEnv(env)}
                        className={`p-3 rounded-xl border text-center transition font-semibold ${
                          targetEnv === env
                            ? 'bg-blue-600/20 border-blue-500 text-white ring-1 ring-blue-500/40'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {env}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Production Warning Notice */}
                {targetEnv === 'Production' && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong>Production Release Protection:</strong> Deploying to Production directly affects
                      end-user workloads. Ensure build tests have completed and verification passed.
                    </div>
                  </div>
                )}

                {/* Repository Selection */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                    2. Select Repository:
                  </label>
                  <select
                    value={selectedRepoId}
                    onChange={(e) => setSelectedRepoId(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-blue-500 text-xs"
                  >
                    {repositories.map((repo) => (
                      <option key={repo.id} value={repo.id}>
                        {repo.name} ({repo.owner || 'DevWeave'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Branch Selection */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                    3. Select Branch:
                  </label>
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-blue-500 text-xs"
                  >
                    {branches.length > 0 ? (
                      branches.map((b) => (
                        <option key={b.name} value={b.name}>
                          {b.name} {b.isDefault ? '(default)' : ''}
                        </option>
                      ))
                    ) : (
                      <option value="main">main</option>
                    )}
                  </select>
                </div>

                {/* Strategy Selector */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                    4. Deployment Strategy:
                  </label>
                  <select
                    value={deployStrategy}
                    onChange={(e) => setDeployStrategy(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-blue-500 text-xs"
                  >
                    <option value="RollingUpdate">RollingUpdate (Zero Downtime)</option>
                    <option value="Blue/Green">Blue/Green (Traffic Switching)</option>
                    <option value="Canary">Canary (Gradual Ramp)</option>
                  </select>
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowDeployModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeploy}
                    disabled={deploying}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition flex items-center gap-2"
                  >
                    {deploying ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Triggering Deployment...</span>
                      </>
                    ) : (
                      <>
                        <Rocket className="w-3.5 h-3.5" />
                        <span>Confirm & Deploy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Safe Rollback Confirmation Modal */}
      {rollbackEnv && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Safe Rollback: {rollbackEnv.name}</h3>
                <p className="text-xs text-slate-400">Revert active workload to prior verified release.</p>
              </div>
            </div>

            {rollbackError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{rollbackError}</span>
              </div>
            )}

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Environment:</span>
                <span className="font-semibold text-white">{rollbackEnv.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Commit:</span>
                <span className="font-mono text-blue-300">
                  {rollbackEnv.commitSha?.substring(0, 7) || 'HEAD'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Workload Target:</span>
                <span className="font-mono text-slate-400">
                  {rollbackEnv.workloadTarget?.name || 'cluster-workload'}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                Rollback Reason (Recorded in Audit Log):
              </label>
              <input
                type="text"
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
                placeholder="e.g. Critical regression observed in production release"
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-500 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRollbackEnv(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRollback}
                disabled={rollingBack}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-amber-600/20 transition flex items-center gap-1.5"
              >
                {rollingBack ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing Rollback...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Confirm Rollback</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Environment Detail Modal */}
      {selectedEnvDetail && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-2xl p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{selectedEnvDetail.name} Environment</span>
                    <StatusBadge
                      status={getBadgeType(selectedEnvDetail.status)}
                      customLabel={selectedEnvDetail.status}
                      size="sm"
                    />
                  </h3>
                  <p className="text-xs text-slate-400">{selectedEnvDetail.description}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEnvDetail(null)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Overview Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-500 block text-[11px]">Strategy:</span>
                <span className="font-semibold text-white font-mono">{selectedEnvDetail.strategy}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-500 block text-[11px]">Active Release:</span>
                <span className="font-semibold text-white font-mono">
                  {selectedEnvDetail.version || 'None'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-500 block text-[11px]">Workload:</span>
                <span className="font-semibold text-white font-mono truncate block">
                  {selectedEnvDetail.workloadTarget?.name || 'Unprovisioned'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-500 block text-[11px]">Approval:</span>
                <span className="font-semibold text-white">
                  {selectedEnvDetail.requiresApproval ? 'Required' : 'Standard'}
                </span>
              </div>
            </div>

            {/* Live Pods Section */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>Live Pods ({selectedEnvDetail.livePods?.length || 0})</span>
              </h4>
              {selectedEnvDetail.livePods && selectedEnvDetail.livePods.length > 0 ? (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {selectedEnvDetail.livePods.map((pod) => (
                    <div
                      key={pod.name}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        <span className="font-mono text-white truncate">{pod.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-400 text-[11px] font-mono shrink-0">
                        <span>Restarts: {pod.restarts}</span>
                        <span>{pod.age}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-500 italic">
                  No live cluster pods active for this environment.
                </div>
              )}
            </div>

            {/* Audit History */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                <span>Audit Trail ({selectedEnvDetail.auditTrail?.length || 0})</span>
              </h4>
              {selectedEnvDetail.auditTrail && selectedEnvDetail.auditTrail.length > 0 ? (
                <div className="space-y-1.5 max-h-36 overflow-y-auto text-xs">
                  {selectedEnvDetail.auditTrail.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            ev.action === 'DEPLOY'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-amber-500/10 text-amber-400'
                          }`}
                        >
                          {ev.action}
                        </span>
                        <span className="text-slate-300 truncate">{ev.userEmail || 'operator'}</span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-500 italic">
                  No audit events recorded for this environment yet.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedEnvDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Logs Viewer Modal */}
      {viewingLogsRecord && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-2xl p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-blue-400" />
                  <span>Deployment Logs: {viewingLogsRecord.repositoryName}</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Target: {viewingLogsRecord.environment} • Branch: {viewingLogsRecord.branch}
                </p>
              </div>
              <button
                onClick={() => setViewingLogsRecord(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-black/90 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-200 select-all whitespace-pre-wrap leading-relaxed">
              {viewingLogsRecord.logs || 'No logs recorded.'}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 shrink-0">
              <button
                onClick={() => handleCopy(viewingLogsRecord.logs || '', 'logs-copy')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs flex items-center gap-1.5"
              >
                {copiedKey === 'logs-copy' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedKey === 'logs-copy' ? 'Copied' : 'Copy Logs'}</span>
              </button>
              <button
                onClick={() => setViewingLogsRecord(null)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
