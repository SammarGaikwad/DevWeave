import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  GitBranch,
  FolderGit2,
  Cpu,
  Play,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Terminal,
  FileCode,
  Copy,
  Check,
  Shield,
  StopCircle,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { StatusBadge } from '../ui/StatusBadge';
import { githubService } from '../../services/githubService';
import {
  dockerService,
  type DetectedStack,
  type GeneratedDockerConfig,
  type DockerBuildJob,
  type BuildLogEntry,
  type DockerRunnerStatus,
} from '../../services/dockerService';
import type { Repository, BranchInfo } from '../../types/repository';

interface OneClickDockerizerProps {
  runnerStatus: DockerRunnerStatus | null;
  onRefreshRunnerStatus: () => void;
}

export const OneClickDockerizer: React.FC<OneClickDockerizerProps> = ({
  runnerStatus,
  onRefreshRunnerStatus,
}) => {
  // Step navigation: 1: repo/branch, 2: analyze, 3: config, 4: build & logs
  const [step, setStep] = useState<number>(1);

  // Repositories & Branches
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('main');
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [customRepoName, setCustomRepoName] = useState('');

  // Analysis State
  const [analyzing, setAnalyzing] = useState(false);
  const [detectedStack, setDetectedStack] = useState<DetectedStack | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Configuration State
  const [generatedConfig, setGeneratedConfig] = useState<GeneratedDockerConfig | null>(null);
  const [activeConfigTab, setActiveConfigTab] = useState<'dockerfile' | 'dockerignore' | 'compose' | 'diff'>('dockerfile');
  const [editedDockerfile, setEditedDockerfile] = useState<string>('');
  const [editedDockerignore, setEditedDockerignore] = useState<string>('');
  const [imageTag, setImageTag] = useState<string>('');
  const [copied, setCopied] = useState<string | null>(null);

  // Build & Logs State
  const [activeJob, setActiveJob] = useState<DockerBuildJob | null>(null);
  const [logs, setLogs] = useState<BuildLogEntry[]>([]);
  const [building, setBuilding] = useState<boolean>(false);
  const [buildDuration, setBuildDuration] = useState<number>(0);
  const [cancelling, setCancelling] = useState(false);

  // Build History
  const [buildHistory, setBuildHistory] = useState<DockerBuildJob[]>([]);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch repositories
  const fetchRepositories = useCallback(async () => {
    setLoadingRepos(true);
    try {
      const repos = await githubService.getRepositories();
      setRepositories(repos);
      if (repos.length > 0 && !selectedRepo) {
        setSelectedRepo(repos[0]);
        setSelectedBranch(repos[0].defaultBranch || 'main');
      }
    } catch (err) {
      console.warn('Could not load GitHub repositories:', err);
    } finally {
      setLoadingRepos(false);
    }
  }, [selectedRepo]);

  // Fetch branches when repository changes
  useEffect(() => {
    if (!selectedRepo) return;
    const fetchBranches = async () => {
      setLoadingBranches(true);
      try {
        const branchList = await githubService.getBranches(selectedRepo.id);
        setBranches(branchList);
        const hasDefault = branchList.some((b) => b.name === selectedRepo.defaultBranch);
        setSelectedBranch(hasDefault ? selectedRepo.defaultBranch || 'main' : branchList[0]?.name || 'main');
      } catch {
        setBranches([{ name: selectedRepo.defaultBranch || 'main', commitSha: '' }]);
        setSelectedBranch(selectedRepo.defaultBranch || 'main');
      } finally {
        setLoadingBranches(false);
      }
    };
    fetchBranches();
  }, [selectedRepo]);

  // Load build history
  const fetchHistory = useCallback(async () => {
    try {
      const jobs = await dockerService.listBuildJobs();
      setBuildHistory(jobs);
    } catch {
      // Ignore initial history error
    }
  }, []);

  useEffect(() => {
    fetchRepositories();
    fetchHistory();
  }, [fetchRepositories, fetchHistory]);

  // Auto-scroll logs terminal
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Handle Project Analysis
  const handleAnalyze = async () => {
    const repoFullName = selectedRepo ? selectedRepo.fullName || selectedRepo.name : customRepoName.trim();
    if (!repoFullName) {
      setAnalysisError('Please select or specify a repository to analyze.');
      return;
    }

    setAnalyzing(true);
    setAnalysisError(null);

    try {
      const result = await dockerService.analyzeProject({
        repositoryId: selectedRepo?.id,
        repoFullName,
        branch: selectedBranch,
      });

      setDetectedStack(result.analysis);

      // Auto-generate Docker configuration
      const config = await dockerService.generateConfig(result.analysis);
      setGeneratedConfig(config);
      setEditedDockerfile(config.dockerfile);
      setEditedDockerignore(config.dockerignore);

      // Deterministic default image tag (clean lowercase)
      const cleanRepo = repoFullName.split('/')[1] || repoFullName;
      const cleanTag = cleanRepo.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
      setImageTag(`${cleanTag}:${selectedBranch.replace(/[^a-zA-Z0-9_.-]/g, '-')}`);

      setStep(2);
    } catch (err: any) {
      setAnalysisError(err.response?.data?.message || err.message || 'Failed to analyze project.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Start Docker Build
  const handleStartBuild = async () => {
    const repoFullName = selectedRepo ? selectedRepo.fullName || selectedRepo.name : customRepoName.trim();
    if (!repoFullName || !imageTag || !editedDockerfile) return;

    setBuilding(true);
    setLogs([]);
    setBuildDuration(0);
    setStep(4);

    try {
      const job = await dockerService.createBuildJob({
        repositoryId: selectedRepo?.id,
        repoFullName,
        branch: selectedBranch,
        imageTag: imageTag.trim(),
        dockerfile: editedDockerfile,
        dockerignore: editedDockerignore,
        composeFile: generatedConfig?.composeFile,
        detectedStack: detectedStack || undefined,
      });

      setActiveJob(job);
      setLogs(job.logs || []);

      // Start elapsed timer
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setBuildDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      // Poll for logs and status
      startLogPolling(job.id);
    } catch (err: any) {
      setBuilding(false);
      setAnalysisError(err.response?.data?.message || err.message || 'Failed to start Docker build.');
    }
  };

  // Log and status polling loop
  const startLogPolling = (jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const update = await dockerService.getBuildLogs(jobId);
        setLogs(update.logs);

        if (['SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT'].includes(update.status)) {
          if (pollRef.current) clearInterval(pollRef.current);
          if (timerRef.current) clearInterval(timerRef.current);
          setBuilding(false);

          // Refresh full job details
          const fullJob = await dockerService.getBuildJob(jobId);
          setActiveJob(fullJob);
          fetchHistory();
        }
      } catch (err) {
        console.warn('Log polling error:', err);
      }
    }, 1500);
  };

  // Cancel build
  const handleCancelBuild = async () => {
    if (!activeJob) return;
    setCancelling(true);
    try {
      const updated = await dockerService.cancelBuildJob(activeJob.id);
      setActiveJob(updated);
    } catch (err) {
      console.error('Failed to cancel build:', err);
    } finally {
      setCancelling(false);
    }
  };

  // Copy helper
  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const isRunnerOnline = Boolean(runnerStatus?.online);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <GlassCard className="border border-indigo-500/20 bg-gradient-to-r from-indigo-950/30 via-slate-900/60 to-purple-950/30">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white">One-Click Dockerization Platform</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Auto-Stack Engine
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Select any connected repository, let DevWeave analyze the architecture, generate multi-stage container configurations, and execute real Docker builds locally.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-xs">
              <span className="text-slate-400">Runner:</span>
              <StatusBadge
                status={isRunnerOnline ? 'Healthy' : 'Offline'}
                customLabel={isRunnerOnline ? 'ONLINE' : 'OFFLINE'}
                size="sm"
              />
            </div>
            <button
              onClick={onRefreshRunnerStatus}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Refresh Runner Telemetry"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Workflow Progress Breadcrumb */}
        <div className="grid grid-cols-4 gap-2 mt-6 pt-5 border-t border-slate-800/80">
          {[
            { num: 1, title: 'Repository & Branch' },
            { num: 2, title: 'Stack Analysis' },
            { num: 3, title: 'Review & Config' },
            { num: 4, title: 'Build & Execution' },
          ].map((s) => (
            <div
              key={s.num}
              onClick={() => {
                if (s.num <= step || (s.num === 3 && detectedStack) || (s.num === 4 && activeJob)) {
                  setStep(s.num);
                }
              }}
              className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-all ${
                step === s.num
                  ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-300'
                  : s.num < step
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === s.num
                    ? 'bg-indigo-500 text-white'
                    : s.num < step
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {s.num < step ? <Check className="w-3.5 h-3.5" /> : s.num}
              </div>
              <span className="text-xs font-medium truncate">{s.title}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Runner Offline Warning Alert */}
      {!isRunnerOnline && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <h4 className="font-semibold text-amber-300">Local Docker Desktop Runner is Offline</h4>
            <p className="text-slate-300 mt-1">
              Analysis and configuration generation work online. However, to execute Docker image builds, your Windows runner must be running.
            </p>
            <div className="mt-2 text-xs font-mono bg-slate-950/70 p-2 rounded border border-slate-800 text-slate-300 flex items-center justify-between">
              <code>cd devweave-backend; .\scripts\run-docker-runner.ps1</code>
              <button
                onClick={() =>
                  copyToClipboard('cd devweave-backend; .\\scripts\\run-docker-runner.ps1', 'runner-cmd')
                }
                className="text-slate-400 hover:text-white"
              >
                {copied === 'runner-cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 1: Repository & Branch Selector */}
      {step === 1 && (
        <GlassCard className="space-y-6">
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-white">Select Project Repository</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Repository Picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Authorized Repositories ({repositories.length})
              </label>
              {loadingRepos ? (
                <div className="h-10 rounded-lg bg-slate-800/60 animate-pulse border border-slate-700" />
              ) : repositories.length > 0 ? (
                <select
                  value={selectedRepo?.id || ''}
                  onChange={(e) => {
                    const repo = repositories.find((r) => r.id === e.target.value);
                    if (repo) setSelectedRepo(repo);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {repositories.map((repo) => (
                    <option key={repo.id} value={repo.id}>
                      {repo.fullName || repo.name} ({repo.language || 'Multi-stack'})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="e.g. SammarGaikwad/DevWeave"
                    value={customRepoName}
                    onChange={(e) => setCustomRepoName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-xs text-slate-400">
                    No repositories found from GitHub. Enter an authorized repository in "owner/repo" format.
                  </p>
                </div>
              )}
            </div>

            {/* Branch Picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Target Branch
              </label>
              {loadingBranches ? (
                <div className="h-10 rounded-lg bg-slate-800/60 animate-pulse border border-slate-700" />
              ) : (
                <div className="relative">
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    {branches.map((b) => (
                      <option key={b.name} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <GitBranch className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              )}
            </div>
          </div>

          {analysisError && (
            <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{analysisError}</span>
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-800">
            <button
              onClick={handleAnalyze}
              disabled={analyzing || (!selectedRepo && !customRepoName.trim())}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-indigo-600/30 transition-all"
            >
              {analyzing ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  Analyzing Repository Architecture...
                </>
              ) : (
                <>
                  <Cpu className="w-4 h-4" />
                  Analyze Project & Generate Docker Config
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </GlassCard>
      )}

      {/* STEP 2: Detected Stack & Architecture Summary */}
      {step === 2 && detectedStack && (
        <div className="space-y-6">
          <GlassCard className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">Detected Technology Stack</h3>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold uppercase ${
                detectedStack.confidence === 'high'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {detectedStack.confidence} Confidence
              </span>
            </div>

            {/* Stack Highlights Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-xs text-slate-400">Framework</span>
                <p className="text-sm font-semibold text-white mt-1">{detectedStack.framework}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-xs text-slate-400">Language</span>
                <p className="text-sm font-semibold text-white mt-1">{detectedStack.language}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-xs text-slate-400">Package Manager</span>
                <p className="text-sm font-semibold text-white mt-1">{detectedStack.packageManager}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-xs text-slate-400">Target Port</span>
                <p className="text-sm font-semibold text-white mt-1">Port {detectedStack.defaultPort}</p>
              </div>
            </div>

            {/* Commands & Scripts */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs font-mono">
              {detectedStack.buildCommand && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Build Command:</span>
                  <span className="text-indigo-300">{detectedStack.buildCommand}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Start / Runtime Command:</span>
                <span className="text-emerald-300">{detectedStack.startCommand}</span>
              </div>
            </div>

            {/* Warnings or Assumptions */}
            {detectedStack.warnings.length > 0 && (
              <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
                {detectedStack.warnings.map((w, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white"
              >
                Change Repository
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all"
              >
                Review & Edit Dockerfile
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* STEP 3: Review & Edit Configuration */}
      {step === 3 && generatedConfig && (
        <GlassCard className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode className="w-5 h-5 text-indigo-400" />
              <h3 className="text-lg font-bold text-white">Review Generated Configuration</h3>
            </div>
            <div className="flex items-center gap-2">
              {['dockerfile', 'dockerignore', ...(generatedConfig.composeFile ? ['compose'] : []), ...(generatedConfig.diffs?.dockerfileDiff ? ['diff'] : [])].map(
                (tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveConfigTab(tab as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      activeConfigTab === tab
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800/80 text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab === 'dockerfile'
                      ? 'Dockerfile'
                      : tab === 'dockerignore'
                      ? '.dockerignore'
                      : tab === 'compose'
                      ? 'docker-compose.yml'
                      : 'Diff vs Existing'}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Security Best Practices Badge Row */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Multi-Stage Build
            </span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Non-Root Execution
            </span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Layer Caching Optimized
            </span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              No Secrets Embedded
            </span>
          </div>

          {/* Code Editor Preview */}
          <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-400">
              <span>{activeConfigTab.toUpperCase()}</span>
              <button
                onClick={() =>
                  copyToClipboard(
                    activeConfigTab === 'dockerfile'
                      ? editedDockerfile
                      : activeConfigTab === 'dockerignore'
                      ? editedDockerignore
                      : activeConfigTab === 'compose'
                      ? generatedConfig.composeFile || ''
                      : generatedConfig.diffs?.dockerfileDiff || '',
                    'editor'
                  )
                }
                className="flex items-center gap-1 text-slate-400 hover:text-white"
              >
                {copied === 'editor' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied === 'editor' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {activeConfigTab === 'dockerfile' ? (
              <textarea
                value={editedDockerfile}
                onChange={(e) => setEditedDockerfile(e.target.value)}
                rows={16}
                className="w-full bg-slate-950 text-slate-200 font-mono text-xs p-4 focus:outline-none resize-y"
              />
            ) : activeConfigTab === 'dockerignore' ? (
              <textarea
                value={editedDockerignore}
                onChange={(e) => setEditedDockerignore(e.target.value)}
                rows={12}
                className="w-full bg-slate-950 text-slate-200 font-mono text-xs p-4 focus:outline-none resize-y"
              />
            ) : activeConfigTab === 'compose' ? (
              <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto">
                {generatedConfig.composeFile}
              </pre>
            ) : (
              <pre className="p-4 text-xs font-mono text-amber-300 overflow-x-auto">
                {generatedConfig.diffs?.dockerfileDiff}
              </pre>
            )}
          </div>

          {/* Image Tag Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Target Docker Image Tag
              </label>
              <input
                type="text"
                value={imageTag}
                onChange={(e) => setImageTag(e.target.value)}
                placeholder="my-service:v1.0.0"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Deterministic tag based on repository and branch name.
              </span>
            </div>

            <div className="flex flex-col justify-end">
              <button
                onClick={handleStartBuild}
                disabled={building || !imageTag.trim()}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white shadow-lg shadow-emerald-600/30 transition-all"
              >
                <Play className="w-4 h-4 fill-white" />
                Build Docker Image
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* STEP 4: Live Build Logs & Result */}
      {step === 4 && (
        <GlassCard className="space-y-6">
          {/* Status Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/90 border border-slate-800">
            <div className="flex items-center gap-3">
              {activeJob?.status === 'SUCCEEDED' ? (
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              ) : activeJob?.status === 'FAILED' ? (
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <XCircle className="w-6 h-6" />
                </div>
              ) : activeJob?.status === 'CANCELLED' ? (
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <StopCircle className="w-6 h-6" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <RotateCw className="w-6 h-6 animate-spin" />
                </div>
              )}

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">
                    {activeJob?.imageTag || imageTag}
                  </h3>
                  <StatusBadge
                    status={
                      activeJob?.status === 'SUCCEEDED'
                        ? 'Healthy'
                        : activeJob?.status === 'FAILED'
                        ? 'Failed'
                        : activeJob?.status === 'CANCELLED'
                        ? 'Warning'
                        : 'Running'
                    }
                    customLabel={activeJob?.status || 'BUILDING'}
                    size="sm"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Job ID: {activeJob?.id || 'Initializing...'} • Branch: {selectedBranch}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Duration</span>
                <span className="text-sm font-mono font-semibold text-white flex items-center gap-1 justify-end">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {activeJob?.durationMs
                    ? `${(activeJob.durationMs / 1000).toFixed(1)}s`
                    : `${buildDuration}s`}
                </span>
              </div>

              {building && (
                <button
                  onClick={handleCancelBuild}
                  disabled={cancelling}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <StopCircle className="w-4 h-4" />
                  {cancelling ? 'Cancelling...' : 'Cancel Build'}
                </button>
              )}
            </div>
          </div>

          {/* Success Banner */}
          {activeJob?.status === 'SUCCEEDED' && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  Docker Image Built Successfully!
                </div>
                {activeJob.imageSize && (
                  <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                    Size: {activeJob.imageSize}
                  </span>
                )}
              </div>

              {activeJob.imageId && (
                <div className="text-xs font-mono text-slate-300 flex items-center gap-2">
                  <span className="text-slate-400">Image ID:</span>
                  <span className="bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">
                    {activeJob.imageId}
                  </span>
                </div>
              )}

              {/* Local Run Snippet */}
              <div className="pt-2 border-t border-emerald-500/20">
                <span className="text-xs text-slate-300 block mb-1">Run this image locally:</span>
                <div className="p-2.5 rounded-lg bg-slate-950 font-mono text-xs text-emerald-300 flex items-center justify-between border border-slate-800">
                  <code>
                    docker run -d -p {detectedStack?.defaultPort || 8080}:{detectedStack?.defaultPort || 8080} {activeJob.imageTag}
                  </code>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `docker run -d -p ${detectedStack?.defaultPort || 8080}:${detectedStack?.defaultPort || 8080} ${activeJob.imageTag}`,
                        'run-cmd'
                      )
                    }
                    className="text-slate-400 hover:text-white"
                  >
                    {copied === 'run-cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Failure Banner */}
          {activeJob?.status === 'FAILED' && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <XCircle className="w-5 h-5 text-rose-400" />
                Build Failed
              </div>
              <p className="text-xs text-slate-300">
                {activeJob.errorDetails || 'Docker build failed during stage execution. Check the logs below for root cause.'}
              </p>
            </div>
          )}

          {/* Terminal Logs Viewer */}
          <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span className="font-mono">Live Build Output ({logs.length} lines)</span>
              </div>
              <button
                onClick={() =>
                  copyToClipboard(logs.map((l) => `[${l.timestamp}] [${l.stage}] ${l.message}`).join('\n'), 'all-logs')
                }
                className="flex items-center gap-1 text-slate-400 hover:text-white"
              >
                {copied === 'all-logs' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy Logs</span>
              </button>
            </div>

            <div className="p-4 font-mono text-xs max-h-96 overflow-y-auto space-y-1">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic">Waiting for runner to claim job and stream build output...</div>
              ) : (
                logs.map((log, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-2.5 ${
                      log.severity === 'error'
                        ? 'text-rose-400'
                        : log.severity === 'warn'
                        ? 'text-amber-300'
                        : 'text-slate-300'
                    }`}
                  >
                    <span className="text-slate-600 shrink-0 text-[10px] pt-0.5">
                      {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
                    </span>
                    <span className="text-indigo-400/80 shrink-0">[{log.stage}]</span>
                    <span className="break-all">{log.message}</span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => setStep(3)}
              className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white"
            >
              Back to Configuration
            </button>
            {activeJob && !building && (
              <button
                onClick={() => {
                  setActiveJob(null);
                  setStep(1);
                }}
                className="px-5 py-2.5 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-white font-medium"
              >
                Dockerize Another Project
              </button>
            )}
          </div>
        </GlassCard>
      )}

      {/* Build History Card */}
      {buildHistory.length > 0 && (
        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-bold text-white">Recent Docker Builds</h3>
            </div>
            <button
              onClick={fetchHistory}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              Refresh
            </button>
          </div>

          <div className="divide-y divide-slate-800 text-xs">
            {buildHistory.slice(0, 5).map((job) => (
              <div
                key={job.id}
                onClick={() => {
                  setActiveJob(job);
                  setLogs(job.logs || []);
                  setStep(4);
                }}
                className="py-3 flex items-center justify-between hover:bg-slate-800/40 px-2 rounded-lg cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge
                    status={
                      job.status === 'SUCCEEDED'
                        ? 'Healthy'
                        : job.status === 'FAILED'
                        ? 'Failed'
                        : job.status === 'CANCELLED'
                        ? 'Warning'
                        : 'Running'
                    }
                    customLabel={job.status}
                    size="sm"
                  />
                  <div>
                    <span className="font-semibold text-white">{job.imageTag}</span>
                    <span className="text-slate-400 ml-2">({job.repoFullName})</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-slate-400">
                  {job.imageSize && <span>{job.imageSize}</span>}
                  <span>{new Date(job.createdAt).toLocaleString()}</span>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
};
