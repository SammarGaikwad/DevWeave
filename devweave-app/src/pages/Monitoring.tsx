import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  RefreshCw,
  Server,
  Database,
  Cpu,
  Clock,
  CheckCircle2,
  XCircle,
  GitBranch,
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { StatusBadge, type StatusType } from '../components/ui/StatusBadge';
import {
  monitoringService,
  type SystemMonitoringSnapshot,
  type ServiceHealth,
} from '../services/monitoringService';

export const Monitoring: React.FC = () => {
  const [snapshot, setSnapshot] = useState<SystemMonitoringSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await monitoringService.getSnapshot();
      setSnapshot(data);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch {
      setError('Unable to reach backend monitoring endpoint. Check network or server status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHealth();
  }, [fetchHealth]);

  const getStatusBadgeInfo = (status?: string): { type: StatusType; label: string } => {
    switch (status) {
      case 'HEALTHY':
        return { type: 'Healthy', label: 'Operational' };
      case 'DEGRADED':
        return { type: 'Warning', label: 'Degraded' };
      case 'CRITICAL':
      case 'UNREACHABLE':
        return { type: 'Failed', label: 'Unreachable' };
      default:
        return { type: 'Pending', label: 'Checking...' };
    }
  };

  const getCategoryIcon = (category: ServiceHealth['category']) => {
    switch (category) {
      case 'Core':
        return <Server className="h-5 w-5 text-blue-400" />;
      case 'Database':
        return <Database className="h-5 w-5 text-emerald-400" />;
      case 'CI/CD':
        return <Activity className="h-5 w-5 text-amber-400" />;
      case 'VCS':
        return <GitBranch className="h-5 w-5 text-purple-400" />;
    }
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const overallBadge = getStatusBadgeInfo(snapshot?.overallStatus);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <Activity className="h-7 w-7 text-emerald-400" />
              Platform Telemetry & Health
            </h1>
            <StatusBadge status={overallBadge.type} customLabel={overallBadge.label} />
          </div>
          <p className="text-sm text-white/60 mt-1">
            Real-time status probes for Core API, PostgreSQL Database, Jenkins CI/CD Engine, and GitHub Integration.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-xs font-mono text-white/40 hidden sm:inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Checked {lastRefreshed}
            </span>
          )}
          <button
            onClick={() => void fetchHealth()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/80 hover:text-white hover:bg-white/[0.08] text-xs font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refresh Health</span>
          </button>
        </div>
      </div>

      {/* 2. Error / Retry State */}
      {error && (
        <GlassCard className="p-4 border-rose-500/20 bg-rose-500/10 flex items-center justify-between">
          <div className="flex items-center gap-3 text-rose-300 text-sm">
            <XCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => void fetchHealth()}
            className="px-3 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-medium"
          >
            Retry
          </button>
        </GlassCard>
      )}

      {/* 3. Runtime Statistics Grid */}
      {snapshot && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassCard className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/40 uppercase">Node.js Runtime</span>
              <Cpu className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono">{snapshot.nodeVersion}</div>
            <p className="text-xs text-white/50">Environment: {snapshot.environment}</p>
          </GlassCard>

          <GlassCard className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/40 uppercase">Process Uptime</span>
              <Clock className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono">
              {formatUptime(snapshot.uptimeSeconds)}
            </div>
            <p className="text-xs text-white/50">{snapshot.uptimeSeconds} seconds continuously</p>
          </GlassCard>

          <GlassCard className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/40 uppercase">Heap Memory</span>
              <Activity className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono">
              {snapshot.memoryUsageMb.heapUsed} MB
            </div>
            <p className="text-xs text-white/50">Total allocated: {snapshot.memoryUsageMb.heapTotal} MB</p>
          </GlassCard>

          <GlassCard className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/40 uppercase">RSS Footprint</span>
              <Server className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono">
              {snapshot.memoryUsageMb.rss} MB
            </div>
            <p className="text-xs text-white/50">Resident process memory</p>
          </GlassCard>
        </div>
      )}

      {/* 4. Service Availability Matrix */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Integration Service Status</h2>
          <span className="text-xs text-white/40">
            {snapshot?.services.filter((s) => s.status === 'HEALTHY').length || 0} of{' '}
            {snapshot?.services.length || 0} operational
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {snapshot?.services.map((svc) => {
            const badge = getStatusBadgeInfo(svc.status);
            return (
              <GlassCard key={svc.name} className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
                      {getCategoryIcon(svc.category)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">{svc.name}</h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/50 font-mono">
                          {svc.category}
                        </span>
                      </div>
                      <p className="text-xs text-white/50 mt-0.5 font-mono break-all">{svc.endpoint}</p>
                    </div>
                  </div>
                  <StatusBadge status={badge.type} customLabel={badge.label} size="sm" />
                </div>

                <p className="text-xs text-white/70 bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.04]">
                  {svc.details}
                </p>

                <div className="flex items-center justify-between text-[11px] text-white/40 pt-1 border-t border-white/[0.04] font-mono">
                  <span>
                    Latency:{' '}
                    <strong className={svc.latencyMs ? 'text-emerald-400' : 'text-zinc-500'}>
                      {svc.latencyMs !== null ? `${svc.latencyMs}ms` : 'N/A'}
                    </strong>
                  </span>
                  <span>{new Date(svc.lastChecked).toLocaleTimeString()}</span>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* 5. Honest Status Notice */}
      <GlassCard className="p-4 border-white/[0.06] bg-white/[0.01] flex items-start gap-3 text-xs text-white/60">
        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-white">Empirical Telemetry Guarantee</p>
          <p>
            All latencies, memory footprints, and service states are queried live from real network probes. DevWeave never fabricates uptime percentages, incident history, or artificial 99.99% statistics.
          </p>
        </div>
      </GlassCard>
    </div>
  );
};
