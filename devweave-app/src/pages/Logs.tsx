import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Terminal,
  RefreshCw,
  Search,
  Filter,
  Copy,
  Check,
  XCircle,
  FileText,
  Clock,
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import {
  monitoringService,
  type PlatformLogEntry,
} from '../services/monitoringService';

export const Logs: React.FC = () => {
  const [logs, setLogs] = useState<PlatformLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await monitoringService.getLogs();
      setLogs(data);
    } catch {
      setError('Failed to fetch platform logs. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      void fetchLogs();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        searchQuery === '' ||
        log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.source.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesLevel = selectedLevel === 'ALL' || log.level === selectedLevel;
      const matchesSource = selectedSource === 'ALL' || log.source === selectedSource;

      return matchesSearch && matchesLevel && matchesSource;
    });
  }, [logs, searchQuery, selectedLevel, selectedSource]);

  const getLevelStyles = (level: PlatformLogEntry['level']) => {
    switch (level) {
      case 'ERROR':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'WARN':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'INFO':
      default:
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <Terminal className="h-7 w-7 text-blue-400" />
              Centralized Platform Logs
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {filteredLogs.length} Events
            </span>
          </div>
          <p className="text-sm text-white/60 mt-1">
            Aggregated execution logs from Jenkins CI runner, Express API gateway, PostgreSQL queries, and GitHub events.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded bg-black/40 border-white/[0.1] text-blue-600 focus:ring-0"
            />
            <span>Live Stream (5s)</span>
          </label>
          <button
            onClick={() => void fetchLogs()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/80 hover:text-white hover:bg-white/[0.08] text-xs font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Filters & Search Bar */}
      <GlassCard className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Search log messages, traces, or commit SHAs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-black/40 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-white/40 shrink-0" />
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="px-3 py-2 rounded-lg bg-black/40 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Levels</option>
              <option value="INFO">INFO</option>
              <option value="WARN">WARN</option>
              <option value="ERROR">ERROR</option>
            </select>

            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="px-3 py-2 rounded-lg bg-black/40 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Sources</option>
              <option value="JENKINS_RUNNER">Jenkins Runner</option>
              <option value="API_GATEWAY">API Gateway</option>
              <option value="DATABASE">Database</option>
              <option value="GITHUB_INTEGRATION">GitHub</option>
            </select>
          </div>
        </div>
      </GlassCard>

      {/* 3. Error Banner */}
      {error && (
        <GlassCard className="p-4 border-rose-500/20 bg-rose-500/10 flex items-center justify-between text-rose-300 text-xs">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => void fetchLogs()}
            className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200"
          >
            Retry
          </button>
        </GlassCard>
      )}

      {/* 4. Terminal Log Stream Viewer */}
      <GlassCard className="p-0 overflow-hidden border border-white/[0.08]">
        <div className="bg-black/60 px-4 py-2.5 border-b border-white/[0.08] flex items-center justify-between text-xs text-white/50 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70 inline-block"></span>
            <span className="ml-2 text-white/70">console.stdout.log</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Showing {filteredLogs.length} entries</span>
            <button
              onClick={() => handleCopy(filteredLogs.map((l) => `[${l.timestamp}] [${l.level}] [${l.source}] ${l.message}`).join('\n'), 'all')}
              className="inline-flex items-center gap-1 text-[11px] text-white/60 hover:text-white"
            >
              {copiedId === 'all' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              <span>{copiedId === 'all' ? 'Copied All' : 'Copy All'}</span>
            </button>
          </div>
        </div>

        <div className="bg-black/80 p-4 space-y-1 font-mono text-xs max-h-[580px] overflow-y-auto leading-relaxed select-text">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-white/40 space-y-2">
              <FileText className="h-8 w-8 mx-auto opacity-50" />
              <p>No log records matching active search filters.</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="group flex flex-col sm:flex-row sm:items-start gap-2 py-1.5 px-2 rounded hover:bg-white/[0.04] transition-colors border-b border-white/[0.02]"
              >
                <div className="flex items-center gap-2 shrink-0 sm:w-44 text-[11px] text-white/40">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 sm:w-20">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getLevelStyles(log.level)}`}>
                    {log.level}
                  </span>
                </div>

                <div className="shrink-0 sm:w-36 text-[11px] text-white/50 truncate">
                  [{log.source}]
                </div>

                <div className="flex-1 text-white/80 break-all leading-normal group-hover:text-white">
                  {log.message}
                </div>

                <button
                  onClick={() => handleCopy(`[${log.timestamp}] [${log.level}] [${log.source}] ${log.message}`, log.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-white/40 hover:text-white shrink-0 transition-opacity"
                  title="Copy log entry"
                >
                  {copiedId === log.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            ))
          )}
        </div>
      </GlassCard>
    </div>
  );
};
