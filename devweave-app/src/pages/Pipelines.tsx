import React, { useCallback, useEffect, useState } from 'react';
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
} from 'lucide-react';

import { GlassCard } from '../components/ui/GlassCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { apiClient } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';

type PipelineStatus =
  | 'SUCCESS'
  | 'FAILURE'
  | 'BUILDING'
  | 'NOT_BUILT'
  | 'ABORTED'
  | 'UNSTABLE'
  | 'UNKNOWN';

type StageStatus =
  | 'SUCCESS'
  | 'IN_PROGRESS'
  | 'FAILED'
  | 'PAUSED'
  | 'ABORTED'
  | 'PENDING';

interface PipelineStage {
  id: string;
  name: string;
  status: StageStatus;
  durationMillis: number;
}

interface BuildSummary {
  number: number;
  url: string;
  status: PipelineStatus;
  timestamp: number;
  duration: number;
  commitMessage?: string;
  author?: string;
  stages?: PipelineStage[];
}

interface PipelineStatusResponse {
  name: string;
  url: string;
  status: PipelineStatus;
  latestBuild: BuildSummary | null;
  builds: BuildSummary[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

const statusLabels: Record<PipelineStatus, string> = {
  SUCCESS: 'Success',
  FAILURE: 'Failed',
  BUILDING: 'Building',
  NOT_BUILT: 'Not Built',
  ABORTED: 'Aborted',
  UNSTABLE: 'Unstable',
  UNKNOWN: 'Unknown',
};

function formatDuration(milliseconds: number): string {
  if (!milliseconds) return '—';

  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '—';

  return new Date(timestamp).toLocaleString();
}

function getBadgeStatus(status: PipelineStatus) {
  switch (status) {
    case 'SUCCESS':
      return 'Healthy' as const;

    case 'BUILDING':
      return 'Running' as const;

    case 'FAILURE':
    case 'ABORTED':
      return 'Failed' as const;

    case 'UNSTABLE':
      return 'Warning' as const;

    case 'NOT_BUILT':
      return 'Pending' as const;

    default:
      return 'Offline' as const;
  }
}

function getStatusIcon(status: PipelineStatus) {
  switch (status) {
    case 'SUCCESS':
      return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;

    case 'FAILURE':
    case 'ABORTED':
      return <XCircle className="h-5 w-5 text-red-400" />;

    case 'BUILDING':
      return (
        <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
      );

    default:
      return <Clock3 className="h-5 w-5 text-white/40" />;
  }
}

function getStageIcon(status: StageStatus) {
  switch (status) {
    case 'SUCCESS':
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;

    case 'FAILED':
    case 'ABORTED':
      return <XCircle className="h-4 w-4 text-red-400" />;

    case 'IN_PROGRESS':
      return (
        <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
      );

    default:
      return <Clock3 className="h-4 w-4 text-white/30" />;
  }
}

export const Pipelines: React.FC = () => {
  /*
   * Wait for AuthContext to restore the user's session before
   * requesting the protected Jenkins pipeline endpoints.
   */
  const {
    isLoading: authLoading,
    accessToken,
  } = useAuth();

  const [pipeline, setPipeline] =
    useState<PipelineStatusResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPipeline = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(null);

        const response =
          await apiClient.get<ApiResponse<PipelineStatusResponse>>(
            '/v1/pipelines/status'
          );

        setPipeline(response.data);
      } catch (err: any) {
        setError(
          err?.message ||
            'Failed to load Jenkins pipeline.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  /*
   * Do not call the protected pipeline endpoint until
   * AuthContext has finished restoring the session and
   * an access token is available.
   */
  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!accessToken) {
      setLoading(false);
      setError('Authentication required. Please log in again.');
      return;
    }

    loadPipeline();
  }, [authLoading, accessToken, loadPipeline]);

  const handleTrigger = async () => {
    try {
      setTriggering(true);
      setError(null);

      await apiClient.post('/v1/pipelines/trigger');

      setTimeout(() => {
        loadPipeline(true);
      }, 1500);
    } catch (err: any) {
      setError(
        err?.message ||
          'Failed to trigger Jenkins pipeline.'
      );
    } finally {
      setTriggering(false);
    }
  };

  /*
   * Authentication is still being restored.
   */
  if (authLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-3 text-white/60">
          <Loader2 className="h-5 w-5 animate-spin" />
          Checking authentication...
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-3 text-white/60">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading Jenkins pipeline...
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
            <h1 className="text-2xl font-bold text-white">
              CI/CD Pipelines
            </h1>

            <StatusBadge
              status={
                pipeline
                  ? getBadgeStatus(pipeline.status)
                  : 'Offline'
              }
              customLabel={
                pipeline
                  ? statusLabels[pipeline.status]
                  : 'Unavailable'
              }
            />
          </div>

          <p className="text-sm text-white/60 mt-1">
            Automated testing, build runners, and release pipelines.
          </p>
        </div>

        <div className="flex items-center gap-2">

          {/* Refresh */}
          <button
            onClick={() => loadPipeline(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white/70 hover:text-white hover:bg-white/[0.08] text-sm transition disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                refreshing ? 'animate-spin' : ''
              }`}
            />

            Refresh
          </button>

          {/* Trigger */}
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 text-sm font-medium transition disabled:opacity-50"
          >
            {triggering ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}

            {triggering
              ? 'Triggering...'
              : 'Trigger Pipeline'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <GlassCard className="p-4 border border-red-500/20">
          <div className="flex items-center gap-3 text-red-300">
            <XCircle className="h-5 w-5" />

            <span className="text-sm">
              {error}
            </span>
          </div>
        </GlassCard>
      )}

      {pipeline && (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Pipeline */}
            <GlassCard className="p-5">
              <p className="text-xs text-white/40 uppercase tracking-wider">
                Pipeline
              </p>

              <div className="flex items-center gap-3 mt-3">
                <Workflow className="h-5 w-5 text-blue-400" />

                <div>
                  <p className="text-white font-semibold">
                    {pipeline.name}
                  </p>

                  <a
                    href={pipeline.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 mt-1"
                  >
                    Open Jenkins
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </GlassCard>

            {/* Latest Build */}
            <GlassCard className="p-5">
              <p className="text-xs text-white/40 uppercase tracking-wider">
                Latest Build
              </p>

              {pipeline.latestBuild ? (
                <div className="flex items-center gap-3 mt-3">
                  {getStatusIcon(
                    pipeline.latestBuild.status
                  )}

                  <div>
                    <p className="text-white font-semibold">
                      #{pipeline.latestBuild.number}
                    </p>

                    <p className="text-xs text-white/40 mt-1">
                      {
                        statusLabels[
                          pipeline.latestBuild.status
                        ]
                      }
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-white/50 mt-3">
                  No builds yet
                </p>
              )}
            </GlassCard>

            {/* Duration */}
            <GlassCard className="p-5">
              <p className="text-xs text-white/40 uppercase tracking-wider">
                Build Duration
              </p>

              <p className="text-xl font-semibold text-white mt-3">
                {pipeline.latestBuild
                  ? formatDuration(
                      pipeline.latestBuild.duration
                    )
                  : '—'}
              </p>

              {pipeline.latestBuild && (
                <p className="text-xs text-white/40 mt-1">
                  {formatDate(
                    pipeline.latestBuild.timestamp
                  )}
                </p>
              )}
            </GlassCard>
          </div>

          {/* Latest Build */}
          {pipeline.latestBuild && (
            <GlassCard className="p-6">

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">

                <div>
                  <div className="flex items-center gap-3">

                    <h2 className="text-lg font-semibold text-white">
                      Build #{pipeline.latestBuild.number}
                    </h2>

                    <StatusBadge
                      status={getBadgeStatus(
                        pipeline.latestBuild.status
                      )}
                      customLabel={
                        statusLabels[
                          pipeline.latestBuild.status
                        ]
                      }
                    />
                  </div>

                  {pipeline.latestBuild.commitMessage && (
                    <p className="text-sm text-white/50 mt-2">
                      {pipeline.latestBuild.commitMessage}
                    </p>
                  )}

                  {pipeline.latestBuild.author && (
                    <p className="text-xs text-white/35 mt-1">
                      Triggered by{' '}
                      {pipeline.latestBuild.author}
                    </p>
                  )}
                </div>

                <a
                  href={pipeline.latestBuild.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                >
                  View Build
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>

              {/* Pipeline Stages */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <GitBranch className="h-4 w-4 text-white/50" />

                  <h3 className="text-sm font-medium text-white">
                    Pipeline Stages
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

                  {(pipeline.latestBuild.stages || []).map(
                    (stage) => (
                      <div
                        key={stage.id}
                        className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4"
                      >
                        <div className="flex items-center justify-between gap-2">

                          <span className="text-sm text-white">
                            {stage.name}
                          </span>

                          {getStageIcon(stage.status)}
                        </div>

                        <p className="text-xs text-white/35 mt-2">
                          {stage.durationMillis
                            ? formatDuration(
                                stage.durationMillis
                              )
                            : stage.status === 'PENDING'
                              ? 'Pending'
                              : '—'}
                        </p>
                      </div>
                    )
                  )}

                </div>
              </div>
            </GlassCard>
          )}

          {/* Build History */}
          <GlassCard className="p-6">

            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Build History
                </h2>

                <p className="text-xs text-white/40 mt-1">
                  Recent Jenkins builds
                </p>
              </div>
            </div>

            <div className="space-y-2">

              {pipeline.builds.length > 0 ? (
                pipeline.builds.map((build) => (
                  <div
                    key={build.number}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 hover:bg-white/[0.04] transition"
                  >

                    <div className="flex items-center gap-3">

                      {getStatusIcon(build.status)}

                      <div>
                        <p className="text-sm font-medium text-white">
                          Build #{build.number}
                        </p>

                        <p className="text-xs text-white/35 mt-1">
                          {formatDate(build.timestamp)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 text-xs">

                      <span className="text-white/50">
                        {statusLabels[build.status]}
                      </span>

                      <span className="text-white/35">
                        {formatDuration(build.duration)}
                      </span>

                      <a
                        href={build.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>

                    </div>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-sm text-white/40">
                  No Jenkins builds found.
                </div>
              )}

            </div>
          </GlassCard>
        </>
      )}
    </div>
  );
};