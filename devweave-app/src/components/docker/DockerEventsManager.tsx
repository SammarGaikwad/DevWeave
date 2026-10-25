import React, { useState, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { type DockerAuditEvent } from '../../services/dockerService';
import { GlassCard } from '../ui/GlassCard';

interface DockerEventsManagerProps {
  events: DockerAuditEvent[];
  loading: boolean;
  onRefresh: () => void;
}

export const DockerEventsManager: React.FC<DockerEventsManagerProps> = ({
  events,
  loading,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'SUCCESS' | 'BLOCKED_PROTECTION' | 'FAILED'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const matchesSearch =
        ev.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ev.resourceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ev.resourceType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ev.userId || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || ev.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [events, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage) || 1;
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredEvents.slice(start, start + itemsPerPage);
  }, [filteredEvents, currentPage, itemsPerPage]);

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search audit trail by resource or action..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900/80 border border-slate-700/60 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="flex rounded-xl p-0.5 bg-slate-900/80 border border-slate-800 text-xs">
            <button
              onClick={() => {
                setStatusFilter('all');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'all'
                  ? 'bg-blue-600/30 text-blue-300 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({events.length})
            </button>
            <button
              onClick={() => {
                setStatusFilter('SUCCESS');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'SUCCESS'
                  ? 'bg-emerald-600/30 text-emerald-300 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Success
            </button>
            <button
              onClick={() => {
                setStatusFilter('BLOCKED_PROTECTION');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'BLOCKED_PROTECTION'
                  ? 'bg-red-600/30 text-red-300 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Blocked
            </button>
            <button
              onClick={() => {
                setStatusFilter('FAILED');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'FAILED'
                  ? 'bg-amber-600/30 text-amber-300 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Failed
            </button>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-xl border border-slate-700/60 transition flex items-center gap-1.5 text-xs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Events Timeline / Table */}
      <GlassCard className="overflow-hidden p-0 border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/40 text-slate-400 font-medium uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Resource Target</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Details / Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginatedEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <p className="font-medium text-sm text-slate-300">No audit events recorded yet</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Docker lifecycle actions, container starts, stops, and modifications will appear here.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedEvents.map((ev) => {
                  return (
                    <tr key={ev.id} className="hover:bg-slate-850/40 transition">
                      {/* Timestamp */}
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{new Date(ev.timestamp).toLocaleTimeString()}</span>
                          <span className="text-slate-600">({new Date(ev.timestamp).toLocaleDateString()})</span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-200">
                        {ev.action}
                      </td>

                      {/* Type */}
                      <td className="py-3 px-4 uppercase text-[10px] text-slate-400">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                          {ev.resourceType}
                        </span>
                      </td>

                      {/* Resource */}
                      <td className="py-3 px-4 font-mono text-slate-200 font-semibold">
                        {ev.resourceName}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {ev.status === 'SUCCESS' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[10px] font-medium flex items-center gap-1 w-fit">
                            <CheckCircle className="w-3 h-3 text-emerald-400" /> Success
                          </span>
                        ) : ev.status === 'BLOCKED_PROTECTION' ? (
                          <span className="px-2 py-0.5 rounded-full bg-red-950/60 border border-red-500/40 text-red-300 text-[10px] font-medium flex items-center gap-1 w-fit">
                            <ShieldAlert className="w-3 h-3 text-red-400" /> Blocked
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-500/40 text-amber-300 text-[10px] font-medium flex items-center gap-1 w-fit">
                            <XCircle className="w-3 h-3 text-amber-400" /> Failed
                          </span>
                        )}
                      </td>

                      {/* Details / Error */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400 max-w-xs truncate">
                        {ev.error ? (
                          <span className="text-red-400">{ev.error}</span>
                        ) : ev.details ? (
                          <span>{JSON.stringify(ev.details)}</span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950/30 text-xs text-slate-400">
            <span>
              Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, filteredEvents.length)} of{' '}
              {filteredEvents.length} events
            </span>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono text-slate-300">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
};
