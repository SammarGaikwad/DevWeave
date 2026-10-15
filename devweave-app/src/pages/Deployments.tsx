import React, { useEffect, useState, useCallback } from 'react';
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
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { pipelineService, type BuildSummary } from '../services/pipelineService';

interface EnvironmentDeployment {
  id: string;
  environment: 'Production' | 'Staging' | 'Development';
  version: string;
  commitSha: string;
  commitMessage: string;
  deployedAt: string;
  status: 'Healthy' | 'Running' | 'Pending';
  url: string;
  replicas: string;
  strategy: 'RollingUpdate' | 'Blue/Green';
}

export const Deployments: React.FC = () => {
  const navigate = useNavigate();
  const [builds, setBuilds] = useState<BuildSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [rollingBackEnv, setRollingBackEnv] = useState<string | null>(null);
  const [rollbackSuccess, setRollbackSuccess] = useState<string | null>(null);

  const fetchBuilds = useCallback(async () => {
    setLoading(true);
    try {
      const list = await pipelineService.getPipelineBuilds();
      setBuilds(list);
    } catch (err) {
      console.warn('Could not query builds for deployments', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBuilds();
  }, [fetchBuilds]);

  const environments: EnvironmentDeployment[] = [
    {
      id: 'env-prod',
      environment: 'Production',
      version: 'v1.4.2',
      commitSha: '9a4bc25',
      commitMessage: 'fix: Render 0.0.0.0 port-binding and health checks',
      deployedAt: '2 hours ago',
      status: 'Healthy',
      url: 'https://dev-weave.vercel.app',
      replicas: '3/3 Pods Ready',
      strategy: 'RollingUpdate',
    },
    {
      id: 'env-staging',
      environment: 'Staging',
      version: 'v1.5.0-rc1',
      commitSha: '3be44d1',
      commitMessage: 'feat(ci): ensure Vitest devDependencies with --include=dev',
      deployedAt: '35 minutes ago',
      status: 'Healthy',
      url: 'https://staging.devweave.internal',
      replicas: '2/2 Pods Ready',
      strategy: 'Blue/Green',
    },
    {
      id: 'env-dev',
      environment: 'Development',
      version: 'v1.5.0-dev.22',
      commitSha: '7fc2dff',
      commitMessage: 'feat(k8s): manifest generator and YAML syntax validator',
      deployedAt: '5 minutes ago',
      status: 'Running',
      url: 'http://localhost:8080',
      replicas: '1/1 Pod Ready',
      strategy: 'RollingUpdate',
    },
  ];

  const handleRollback = (env: string) => {
    setRollingBackEnv(env);
    setTimeout(() => {
      setRollingBackEnv(null);
      setRollbackSuccess(`Successfully initiated instant rollback for ${env} to previous revision.`);
      setTimeout(() => setRollbackSuccess(null), 4000);
    }, 1200);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <Rocket className="h-7 w-7 text-blue-400" />
              Environment Deployments
            </h1>
            <StatusBadge status="Healthy" customLabel="3 Active Environments" />
          </div>
          <p className="text-sm text-white/60 mt-1">
            Multi-environment releases, zero-downtime rolling upgrades, and automated rollback orchestration.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void fetchBuilds()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/80 hover:text-white hover:bg-white/[0.08] text-xs font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => navigate('/pipelines')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all"
          >
            <Rocket className="h-4 w-4" />
            <span>Deploy via Pipeline</span>
          </button>
        </div>
      </div>

      {rollbackSuccess && (
        <GlassCard className="p-4 border-emerald-500/20 bg-emerald-500/10 flex items-center gap-3 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{rollbackSuccess}</span>
        </GlassCard>
      )}

      {/* 2. Environments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {environments.map((env) => (
          <GlassCard key={env.id} className="p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">{env.environment}</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/60 font-mono">
                      {env.version}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 mt-1 font-mono">{env.strategy}</p>
                </div>
                <StatusBadge status={env.status} customLabel={env.status} size="sm" />
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="space-y-1">
                  <span className="text-white/40 block text-[11px]">Active Commit:</span>
                  <div className="flex items-center gap-1.5 text-white/80 font-mono text-[11px] bg-white/[0.02] p-2 rounded-lg border border-white/[0.04]">
                    <GitCommit className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <span className="text-blue-300 font-semibold">{env.commitSha}</span>
                    <span className="truncate text-white/60">{env.commitMessage}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-white/60 pt-1">
                  <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5 text-indigo-400" /> Pods</span>
                  <span className="font-mono text-emerald-400">{env.replicas}</span>
                </div>

                <div className="flex items-center justify-between text-white/60">
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-amber-400" /> Release</span>
                  <span className="text-white/80">{env.deployedAt}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between gap-2">
              <a
                href={env.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <span>Live URL</span>
                <ExternalLink className="h-3 w-3" />
              </a>

              <button
                onClick={() => handleRollback(env.environment)}
                disabled={rollingBackEnv === env.environment}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/80 hover:text-white text-xs font-medium transition-all disabled:opacity-50"
              >
                <RotateCcw className={`h-3 w-3 ${rollingBackEnv === env.environment ? 'animate-spin text-amber-400' : ''}`} />
                <span>{rollingBackEnv === env.environment ? 'Rolling back...' : 'Rollback'}</span>
              </button>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* 3. Release Pipeline History */}
      <GlassCard className="p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <History className="h-4 w-4 text-blue-400" />
              Recent Release & Deployment Executions
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              Audit trail of CI/CD pipeline triggers and environment promotions.
            </p>
          </div>
          <button
            onClick={() => navigate('/pipelines')}
            className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
          >
            <span>View All in Pipelines</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="space-y-2">
          {builds.length === 0 ? (
            <div className="py-8 text-center text-xs text-white/40">
              No recent build runs recorded. Trigger a pipeline to generate release artifacts.
            </div>
          ) : (
            builds.slice(0, 5).map((build) => (
              <div
                key={build.number}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      build.status === 'SUCCESS'
                        ? 'bg-emerald-400'
                        : build.status === 'BUILDING'
                        ? 'bg-blue-400 animate-ping'
                        : 'bg-rose-400'
                    }`}
                  ></div>
                  <div>
                    <span className="text-xs font-semibold text-white font-mono">
                      Build #{build.number} {build.commitMessage ? `• ${build.commitMessage}` : ''}
                    </span>
                    <p className="text-[11px] text-white/50">{new Date(build.timestamp).toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="text-white/60">Duration: {Math.round(build.duration / 1000)}s</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      build.status === 'SUCCESS'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : build.status === 'BUILDING'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'bg-rose-500/10 text-rose-400'
                    }`}
                  >
                    {build.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </GlassCard>
    </div>
  );
};
