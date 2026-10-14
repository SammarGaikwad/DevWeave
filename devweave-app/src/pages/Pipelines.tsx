import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  GitBranch,
  Loader2,
  Play,
  RefreshCw,
  Workflow,
  XCircle,
  Server,
  Layout,
  Container,
  Layers,
  Terminal,
  Copy,
  Check,
  ChevronRight,
  ShieldCheck,
  History,
  FolderGit2,
  Settings2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

import { GlassCard } from '../components/ui/GlassCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import type { StatusType } from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { githubService } from '../services/githubService';
import { apiClient } from '../services/apiClient';
import {
  pipelineService,
} from '../services/pipelineService';
import type {
  PipelineTemplate,
  PipelineRun,
  RunStatus,
  StageRunStatus,
} from '../services/pipelineService';
import type { Repository, BranchInfo } from '../types/repository';

type TabType = 'run' | 'active' | 'templates' | 'history';

function getBadgeStatus(status: RunStatus | string): StatusType {
  switch (status) {
    case 'SUCCESS':
      return 'Healthy';
    case 'RUNNING':
      return 'Running';
    case 'QUEUED':
      return 'Pending';
    case 'FAILED':
    case 'ABORTED':
      return 'Failed';
    default:
      return 'Offline';
  }
}

function formatDuration(milliseconds: number | null | undefined): string {
  if (!milliseconds || milliseconds <= 0) return '—';
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function formatDate(timestamp: string | number | null | undefined): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString();
}

function getTemplateIcon(iconName: string) {
  switch (iconName) {
    case 'Server':
      return <Server className="h-5 w-5 text-emerald-400" />;
    case 'Layout':
      return <Layout className="h-5 w-5 text-blue-400" />;
    case 'Container':
      return <Container className="h-5 w-5 text-cyan-400" />;
    case 'Workflow':
    default:
      return <Workflow className="h-5 w-5 text-purple-400" />;
  }
}

function getStageIcon(status: StageRunStatus) {
  switch (status) {
    case 'SUCCESS':
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case 'FAILED':
      return <XCircle className="h-4 w-4 text-rose-400" />;
    case 'ABORTED':
      return <XCircle className="h-4 w-4 text-amber-400" />;
    case 'RUNNING':
      return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
    case 'PENDING':
    default:
      return <Clock3 className="h-4 w-4 text-white/30" />;
  }
}

export const Pipelines: React.FC = () => {
  const { isLoading: authLoading, accessToken } = useAuth();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<TabType>('run');

  // Templates
  const [templates, setTemplates] = useState<PipelineTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PipelineTemplate | null>(null);

  // Repositories
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('main');

  // Custom configuration
  const [configValues, setConfigValues] = useState<Record<string, any>>({});
  const [detectedType, setDetectedType] = useState<string | null>(null);

  // Execution state
  const [triggering, setTriggering] = useState(false);
  const [activeRun, setActiveRun] = useState<PipelineRun | null>(null);
  const [runLogs, setRunLogs] = useState<string>('');
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);

  // Build History
  const [historyRuns, setHistoryRuns] = useState<PipelineRun[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // General loading & errors
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<any>(null);

  // Load initial templates and repositories
  useEffect(() => {
    if (authLoading || !accessToken) return;

    let isMounted = true;
    async function loadData() {
      try {
        setLoadingInitial(true);
        setErrorMessage(null);

        // Fetch predefined templates
        const tmpls = await pipelineService.listTemplates();
        if (isMounted) {
          setTemplates(tmpls);
          if (tmpls.length > 0) {
            setSelectedTemplate(tmpls[0]);
          }
        }

        // Fetch repositories (from GitHub integration and DB fallback)
        let repos: Repository[] = [];
        try {
          repos = await githubService.getRepositories();
        } catch {
          // If GitHub integration is not connected, fetch DB repos
          try {
            const dbRes = await apiClient.get<{ success: boolean; data: any[] }>('/v1/repositories');
            if (dbRes.data && Array.isArray(dbRes.data)) {
              repos = dbRes.data.map((r: any) => ({
                id: r.id,
                name: r.name,
                fullName: r.fullName || r.name,
                owner: r.owner || 'DevWeave',
                visibility: r.visibility?.toLowerCase() || 'public',
                defaultBranch: r.defaultBranch || 'main',
                language: r.language,
              } as Repository));
            }
          } catch {
            // Repositories empty
          }
        }

        if (isMounted) {
          setRepositories(repos);
          if (repos.length > 0) {
            handleSelectRepository(repos[0], tmpls);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err.message || 'Failed to initialize pipeline templates');
        }
      } finally {
        if (isMounted) {
          setLoadingInitial(false);
        }
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [authLoading, accessToken]);

  // Handle repository selection and intelligent template suggestion
  const handleSelectRepository = async (repo: Repository, availableTemplates = templates) => {
    setSelectedRepo(repo);
    setSelectedBranch(repo.defaultBranch || 'main');

    // Auto-detect template based on repository primary language
    const lang = (repo.language || '').toLowerCase();
    let suggestedTemplateId = 'nodejs-backend-ci';
    let detectedHint = 'Node.js Backend';

    if (lang.includes('react') || repo.name.toLowerCase().includes('frontend') || repo.name.toLowerCase().includes('app')) {
      suggestedTemplateId = 'react-frontend-ci';
      detectedHint = 'React Frontend';
    } else if (lang.includes('docker') || repo.name.toLowerCase().includes('docker')) {
      suggestedTemplateId = 'docker-build';
      detectedHint = 'Docker Container';
    } else if (repo.name.toLowerCase().includes('fullstack') || repo.name.toLowerCase().includes('devweave')) {
      suggestedTemplateId = 'fullstack-ci-cd';
      detectedHint = 'Full-Stack Application';
    }

    setDetectedType(detectedHint);

    const match = availableTemplates.find((t) => t.id === suggestedTemplateId);
    if (match) {
      setSelectedTemplate(match);
      // Initialize default configs
      const defaults: Record<string, any> = {};
      match.configFields.forEach((cf) => {
        defaults[cf.key] = cf.defaultValue;
      });
      setConfigValues(defaults);
    }

    // Fetch branches for selected repo
    try {
      const branchList = await githubService.getBranches(repo.id);
      setBranches(branchList);
      if (branchList.length > 0 && !branchList.some((b) => b.name === repo.defaultBranch)) {
        setSelectedBranch(branchList[0].name);
      }
    } catch {
      setBranches([{ name: repo.defaultBranch || 'main', protected: false }]);
    }

    // Fetch previous runs for repository
    loadRepositoryRuns(repo.id);
  };

  const handleSelectTemplate = (template: PipelineTemplate) => {
    setSelectedTemplate(template);
    const defaults: Record<string, any> = {};
    template.configFields.forEach((cf) => {
      defaults[cf.key] = cf.defaultValue;
    });
    setConfigValues(defaults);
  };

  const loadRepositoryRuns = async (repoId: string) => {
    try {
      setLoadingHistory(true);
      const runs = await pipelineService.getRepositoryRuns(repoId);
      // Jenkins build numbers are unique per job. Collapse duplicate DB run records
      // that accidentally point to the same Jenkins build, while preserving queued runs.
      const seenBuilds = new Set<string>();
      const uniqueRuns = runs.filter((run) => {
        if (run.jenkinsBuildNumber == null) return true;
        const key = `${run.jenkinsJobName}#${run.jenkinsBuildNumber}`;
        if (seenBuilds.has(key)) return false;
        seenBuilds.add(key);
        return true;
      });
      setHistoryRuns(uniqueRuns);
    } catch {
      // Ignore if no runs yet
    } finally {
      setLoadingHistory(false);
    }
  };

  // Trigger pipeline execution
  const handleRunPipeline = async () => {
    if (!selectedRepo || !selectedTemplate) {
      setErrorMessage('Please select both a repository and a pipeline template.');
      return;
    }

    try {
      setTriggering(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      // 1. Configure or ensure repository pipeline exists
      const configured = await pipelineService.configurePipeline(selectedRepo.id, {
        templateId: selectedTemplate.id,
        name: `${selectedRepo.name} - ${selectedTemplate.name}`,
        branch: selectedBranch,
        config: configValues,
      });

      // 2. Trigger pipeline execution run
      const run = await pipelineService.triggerPipelineRun(configured.id);
      setActiveRun(run);
      setActiveTab('active');
      setSuccessMessage(`Build triggered successfully on Jenkins! Tracking execution...`);

      // 3. Refresh repository history
      loadRepositoryRuns(selectedRepo.id);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to trigger Jenkins pipeline execution');
    } finally {
      setTriggering(false);
    }
  };

  // Poll status while run is QUEUED or RUNNING
  useEffect(() => {
    if (!activeRun || !activeRun.id) return;

    if (activeRun.status === 'SUCCESS' || activeRun.status === 'FAILED' || activeRun.status === 'ABORTED') {
      // Final fetch of logs
      fetchLogs(activeRun.id);
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    // Initial log fetch
    fetchLogs(activeRun.id);

    pollingRef.current = setInterval(async () => {
      try {
        const updated = await pipelineService.getPipelineRun(activeRun.id);
        setActiveRun(updated);
        fetchLogs(activeRun.id);

        if (updated.status === 'SUCCESS' || updated.status === 'FAILED' || updated.status === 'ABORTED') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (selectedRepo) loadRepositoryRuns(selectedRepo.id);
        }
      } catch (err) {
        console.warn('Error polling pipeline run status:', err);
      }
    }, 2500);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [activeRun?.id, activeRun?.status]);

  const fetchLogs = async (runId: string) => {
    try {
      setLoadingLogs(true);
      const logRes = await pipelineService.getPipelineRunLogs(runId);
      setRunLogs(logRes.logs || 'No logs recorded yet.');
    } catch {
      // Ignore transient log fetch errors
    } finally {
      setLoadingLogs(false);
    }
  };

  const copyLogsToClipboard = () => {
    if (!runLogs) return;
    navigator.clipboard.writeText(runLogs);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  if (authLoading || loadingInitial) {
    return (
      <div className="flex min-h-[450px] items-center justify-center">
        <div className="flex items-center gap-3 text-white/60">
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          <span>Loading Predefined CI/CD Pipeline System...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Predefined CI/CD Pipelines</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Sparkles className="h-3 w-3" />
              Jenkins Integrated
            </span>
          </div>
          <p className="text-sm text-white/60 mt-1">
            Choose a ready-made CI/CD template, select your GitHub repository, and trigger live Jenkins pipeline builds.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.08]">
          <button
            onClick={() => setActiveTab('run')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'run'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Configure & Run
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
              activeTab === 'active'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Execution Monitor
            {activeRun && (activeRun.status === 'RUNNING' || activeRun.status === 'QUEUED') && (
              <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'templates'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Templates Catalog
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'history'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Build History
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <GlassCard className="p-4 border border-rose-500/30 bg-rose-500/10">
          <div className="flex items-center gap-3 text-rose-300">
            <XCircle className="h-5 w-5 shrink-0" />
            <span className="text-sm">{errorMessage}</span>
          </div>
        </GlassCard>
      )}

      {successMessage && (
        <GlassCard className="p-4 border border-emerald-500/30 bg-emerald-500/10">
          <div className="flex items-center gap-3 text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span className="text-sm">{successMessage}</span>
          </div>
        </GlassCard>
      )}

      {/* TAB 1: RUN PIPELINE */}
      {activeTab === 'run' && (
        <div className="space-y-6">
          {/* Step 1: Select Repository */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FolderGit2 className="h-5 w-5 text-blue-400" />
                <h2 className="text-lg font-semibold text-white">1. Select GitHub Repository</h2>
              </div>
              {selectedRepo && (
                <span className="text-xs text-white/50">
                  {repositories.length} connected repositories available
                </span>
              )}
            </div>

            {repositories.length === 0 ? (
              <div className="p-6 text-center rounded-xl border border-white/[0.08] bg-white/[0.02]">
                <p className="text-white/60 text-sm">No connected GitHub repositories found.</p>
                <a
                  href="/repositories"
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-medium hover:bg-blue-500/30 transition"
                >
                  Connect GitHub Repository
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {repositories.map((repo) => {
                  const isSelected = selectedRepo?.id === repo.id;
                  return (
                    <div
                      key={repo.id}
                      onClick={() => handleSelectRepository(repo)}
                      className={`cursor-pointer p-4 rounded-xl border transition flex flex-col justify-between gap-3 ${
                        isSelected
                          ? 'border-blue-500/60 bg-blue-500/10 shadow-lg shadow-blue-500/10'
                          : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.15]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-white truncate max-w-[200px]">
                            {repo.name}
                          </p>
                          <p className="text-xs text-white/40 truncate">
                            {repo.owner || 'DevWeave'}
                          </p>
                        </div>
                        {isSelected && (
                          <span className="h-2 w-2 rounded-full bg-blue-400 ring-4 ring-blue-400/20" />
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-white/60 border border-white/[0.08]">
                          {repo.defaultBranch || 'main'}
                        </span>
                        {repo.language && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                            {repo.language}
                          </span>
                        )}
                        <span className="capitalize text-white/40 ml-auto">
                          {repo.visibility || 'Public'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>

          {/* Step 2: Choose Predefined Template */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-purple-400" />
                <h2 className="text-lg font-semibold text-white">2. Choose Pipeline Template</h2>
              </div>
              {detectedType && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  <Sparkles className="h-3 w-3" />
                  Detected: {detectedType}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {templates.map((tmpl) => {
                const isSelected = selectedTemplate?.id === tmpl.id;
                return (
                  <div
                    key={tmpl.id}
                    onClick={() => handleSelectTemplate(tmpl)}
                    className={`cursor-pointer p-5 rounded-2xl border transition flex flex-col justify-between gap-4 ${
                      isSelected
                        ? 'border-purple-500/60 bg-purple-500/10 shadow-lg shadow-purple-500/15'
                        : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.15]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08]">
                          {getTemplateIcon(tmpl.icon)}
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-white/60">
                          {tmpl.stages.length} stages
                        </span>
                      </div>

                      <h3 className="text-sm font-semibold text-white">{tmpl.name}</h3>
                      <p className="text-xs text-white/50 mt-1.5 line-clamp-3 leading-relaxed">
                        {tmpl.description}
                      </p>
                    </div>

                    <div>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {tmpl.supportedTechnologies.slice(0, 3).map((tech) => (
                          <span
                            key={tech}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] text-white/60 border border-white/[0.06]"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>

                      <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
                        <span className="text-white/40">{tmpl.category}</span>
                        <span
                          className={`font-medium ${
                            isSelected ? 'text-purple-300' : 'text-white/60'
                          }`}
                        >
                          {isSelected ? 'Selected ✓' : 'Select'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* Step 3: Pipeline Configuration & Stages Preview */}
          {selectedTemplate && selectedRepo && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Configuration Form */}
              <GlassCard className="p-6 lg:col-span-1 space-y-4">
                <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
                  <Settings2 className="h-5 w-5 text-blue-400" />
                  <h3 className="text-base font-semibold text-white">Pipeline Configuration</h3>
                </div>

                {/* Branch Selection */}
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1.5">
                    Target Branch
                  </label>
                  <div className="relative">
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="w-full rounded-xl bg-white/[0.05] border border-white/[0.1] px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                    >
                      {branches.map((b) => (
                        <option key={b.name} value={b.name} className="bg-zinc-900 text-white">
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Config Fields */}
                {selectedTemplate.configFields.map((field) => (
                  <div key={field.key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-white/70">{field.label}</label>
                      {field.required && (
                        <span className="text-[10px] text-amber-400">Required</span>
                      )}
                    </div>
                    {field.type === 'select' ? (
                      <select
                        value={configValues[field.key] ?? field.defaultValue}
                        onChange={(e) =>
                          setConfigValues({ ...configValues, [field.key]: e.target.value })
                        }
                        className="w-full rounded-xl bg-white/[0.05] border border-white/[0.1] px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                      >
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt} className="bg-zinc-900 text-white">
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={configValues[field.key] ?? field.defaultValue}
                        onChange={(e) =>
                          setConfigValues({ ...configValues, [field.key]: e.target.value })
                        }
                        className="w-full rounded-xl bg-white/[0.05] border border-white/[0.1] px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                        placeholder={String(field.defaultValue)}
                      />
                    )}
                    <p className="text-[11px] text-white/40 mt-1">{field.description}</p>
                  </div>
                ))}

                {/* Run Action Button */}
                <div className="pt-4 border-t border-white/[0.08]">
                  <button
                    onClick={handleRunPipeline}
                    disabled={triggering}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium text-sm transition shadow-lg shadow-blue-500/25 disabled:opacity-50 cursor-pointer"
                  >
                    {triggering ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Triggering on Jenkins...</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 fill-white" />
                        <span>Run Pipeline</span>
                      </>
                    )}
                  </button>
                  <p className="text-center text-[11px] text-white/40 mt-2">
                    Validates configuration & triggers server-side Jenkins execution.
                  </p>
                </div>
              </GlassCard>

              {/* Ordered Stages Preview */}
              <GlassCard className="p-6 lg:col-span-2">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-5">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-5 w-5 text-emerald-400" />
                    <h3 className="text-base font-semibold text-white">
                      Ordered Execution Stages ({selectedTemplate.stages.length})
                    </h3>
                  </div>
                  <span className="text-xs text-white/40">Real Jenkins Pipeline Sequence</span>
                </div>

                <div className="space-y-3">
                  {selectedTemplate.stages.map((stage, idx) => (
                    <div
                      key={stage.id}
                      className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-between gap-4 hover:bg-white/[0.04] transition"
                    >
                      <div className="flex items-center gap-3.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] text-xs font-semibold text-white/70">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-white">{stage.name}</p>
                          <p className="text-xs text-white/40 mt-0.5">{stage.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {stage.isOptional && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/50">
                            Optional
                          </span>
                        )}
                        <CheckCircle2 className="h-4 w-4 text-white/30" />
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ACTIVE EXECUTION DASHBOARD */}
      {activeTab === 'active' && (
        <div className="space-y-6">
          {!activeRun ? (
            <GlassCard className="p-12 text-center">
              <Workflow className="h-10 w-10 text-white/30 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white">No Active Pipeline Execution</h3>
              <p className="text-sm text-white/50 mt-1 max-w-md mx-auto">
                Configure and run a pipeline template to monitor real-time Jenkins stage statuses, logs, and build artifacts.
              </p>
              <button
                onClick={() => setActiveTab('run')}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-medium hover:bg-blue-500/30 transition cursor-pointer"
              >
                Configure New Pipeline
              </button>
            </GlassCard>
          ) : (
            <>
              {/* Execution Overview Header */}
              <GlassCard className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5 mb-5">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-white">
                        Build {activeRun.jenkinsBuildNumber ? `#${activeRun.jenkinsBuildNumber}` : '(Queued)'}
                      </h2>
                      <StatusBadge
                        status={getBadgeStatus(activeRun.status)}
                        customLabel={activeRun.status}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-white/50">
                      <span className="flex items-center gap-1">
                        <FolderGit2 className="h-3.5 w-3.5 text-blue-400" />
                        {selectedRepo?.name || activeRun.jenkinsJobName}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-3.5 w-3.5 text-purple-400" />
                        {activeRun.branch}
                      </span>
                      <span>•</span>
                      <span>Template: {selectedTemplate?.name || activeRun.templateId}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fetchLogs(activeRun.id)}
                      disabled={loadingLogs}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-xs text-white/70 hover:text-white hover:bg-white/[0.08] transition cursor-pointer"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>

                    {activeRun.jenkinsBuildUrl && (
                      <a
                        href={activeRun.jenkinsBuildUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/20 border border-blue-500/30 text-xs text-blue-300 hover:bg-blue-500/30 transition"
                      >
                        View in Jenkins
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}

                    <button
                      onClick={handleRunPipeline}
                      disabled={triggering}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-xs font-medium text-indigo-300 hover:bg-indigo-500/30 transition cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Rerun
                    </button>
                  </div>
                </div>

                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-xs text-white/40">Status</span>
                    <p className="text-base font-semibold text-white mt-1">{activeRun.status}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-xs text-white/40">Total Duration</span>
                    <p className="text-base font-semibold text-white mt-1">
                      {formatDuration(activeRun.durationMs)}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-xs text-white/40">Started At</span>
                    <p className="text-base font-semibold text-white mt-1">
                      {formatDate(activeRun.startedAt || activeRun.createdAt)}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-xs text-white/40">Completed At</span>
                    <p className="text-base font-semibold text-white mt-1">
                      {formatDate(activeRun.completedAt)}
                    </p>
                  </div>
                </div>
              </GlassCard>

              {/* Stage Progress Breakdown */}
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-blue-400" />
                    <h3 className="text-base font-semibold text-white">Pipeline Execution Stages</h3>
                  </div>
                  <span className="text-xs text-white/40">Live Jenkins wfapi Sync</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {activeRun.stageRuns.map((stg) => (
                    <div
                      key={stg.id}
                      className={`p-4 rounded-xl border transition ${
                        stg.status === 'SUCCESS'
                          ? 'border-emerald-500/20 bg-emerald-500/5'
                          : stg.status === 'RUNNING'
                          ? 'border-blue-500/30 bg-blue-500/10 shadow-lg shadow-blue-500/10'
                          : stg.status === 'FAILED'
                          ? 'border-rose-500/30 bg-rose-500/10'
                          : 'border-white/[0.06] bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-white truncate">{stg.name}</span>
                        {getStageIcon(stg.status)}
                      </div>
                      <div className="flex items-center justify-between mt-3 text-xs">
                        <span className="capitalize text-white/50">{stg.status.toLowerCase()}</span>
                        <span className="text-white/40">{formatDuration(stg.durationMs)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Console Logs Terminal Viewer */}
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-3 border-b border-white/[0.08] pb-3">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-5 w-5 text-emerald-400" />
                    <h3 className="text-base font-semibold text-white">Live Build Console Output</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={copyLogsToClipboard}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.1] text-xs text-white/70 hover:text-white transition cursor-pointer"
                    >
                      {copiedLogs ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy Logs</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-black/60 p-4 font-mono text-xs text-zinc-300 max-h-[420px] overflow-y-auto leading-relaxed shadow-inner">
                  {runLogs ? (
                    <pre className="whitespace-pre-wrap">{runLogs}</pre>
                  ) : (
                    <div className="py-8 text-center text-white/40">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-400" />
                      Awaiting Jenkins console log output...
                    </div>
                  )}
                  <div ref={logsEndRef} />
                </div>
              </GlassCard>
            </>
          )}
        </div>
      )}

      {/* TAB 3: TEMPLATES CATALOG */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {templates.map((tmpl) => (
              <GlassCard key={tmpl.id} className="p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-white/[0.05] border border-white/[0.08]">
                        {getTemplateIcon(tmpl.icon)}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{tmpl.name}</h3>
                        <span className="text-xs text-purple-400 font-medium">{tmpl.category}</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs bg-white/[0.06] text-white/70 border border-white/[0.08]">
                      {tmpl.stages.length} Stages
                    </span>
                  </div>

                  <p className="text-sm text-white/60 mb-5 leading-relaxed">{tmpl.description}</p>

                  <div className="mb-5">
                    <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2.5">
                      Supported Technologies
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {tmpl.supportedTechnologies.map((tech) => (
                        <span
                          key={tech}
                          className="px-2.5 py-1 rounded-lg text-xs bg-white/[0.04] text-white/70 border border-white/[0.06]"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mb-5">
                    <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2.5">
                      Predefined Stages
                    </p>
                    <div className="space-y-2">
                      {tmpl.stages.map((stg, i) => (
                        <div
                          key={stg.id}
                          className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] text-xs text-white/80"
                        >
                          <span className="h-5 w-5 rounded-full bg-white/[0.06] flex items-center justify-center text-[10px] text-white/50">
                            {i + 1}
                          </span>
                          <span className="font-medium">{stg.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    handleSelectTemplate(tmpl);
                    setActiveTab('run');
                  }}
                  className="w-full mt-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-medium border border-white/[0.1] transition cursor-pointer"
                >
                  <span>Use This Template</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: BUILD HISTORY */}
      {activeTab === 'history' && (
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-white">Execution Build History</h2>
              <p className="text-xs text-white/40 mt-1">
                Real Jenkins pipeline runs recorded for {selectedRepo?.name || 'this repository'}
              </p>
            </div>
            {selectedRepo && (
              <button
                onClick={() => loadRepositoryRuns(selectedRepo.id)}
                disabled={loadingHistory}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-xs text-white/70 hover:text-white transition cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                Refresh History
              </button>
            )}
          </div>

          <div className="space-y-2">
            {historyRuns.length > 0 ? (
              historyRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-2 rounded-lg bg-white/[0.05]">
                      {run.status === 'SUCCESS' ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      ) : run.status === 'RUNNING' ? (
                        <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                      ) : (
                        <XCircle className="h-5 w-5 text-rose-400" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          Build #{run.jenkinsBuildNumber || '—'}
                        </span>
                        <StatusBadge
                          status={getBadgeStatus(run.status)}
                          customLabel={run.status}
                          size="sm"
                        />
                      </div>
                      <p className="text-xs text-white/40 mt-1">
                        Branch: {run.branch} • Template: {run.templateId} • {formatDate(run.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-white/40">Duration: {formatDuration(run.durationMs)}</span>

                    <button
                      onClick={async () => {
                        // Refresh status/stages from Jenkins before opening a historical run.
                        try {
                          const refreshedRun = await pipelineService.getPipelineRun(run.id);
                          setActiveRun(refreshedRun);
                        } catch {
                          setActiveRun(run);
                        }
                        setActiveTab('active');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20 hover:bg-blue-500/20 transition cursor-pointer"
                    >
                      View Logs & Stages
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-sm text-white/40">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No previous build executions found for this repository.
              </div>
            )}
          </div>
        </GlassCard>
      )}
    </div>
  );
};