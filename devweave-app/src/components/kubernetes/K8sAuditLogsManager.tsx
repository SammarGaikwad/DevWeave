import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { KubernetesAuditEvent } from '../../services/kubernetesService';

interface K8sAuditLogsManagerProps {
  auditLogs: KubernetesAuditEvent[];
}

export const K8sAuditLogsManager: React.FC<K8sAuditLogsManagerProps> = ({ auditLogs }) => {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/40">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Resource Kind</th>
              <th className="px-4 py-3">Target Name</th>
              <th className="px-4 py-3">Namespace</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">User ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {auditLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-sans">
                  No Kubernetes audit logs recorded yet. All cluster mutations will appear here.
                </td>
              </tr>
            ) : (
              auditLogs.map((log) => {
                const isSuccess = log.status === 'SUCCESS';
                const isBlocked = log.status === 'BLOCKED_PROTECTION';
                return (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 text-slate-500 text-[11px] font-sans">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-semibold text-indigo-300">{log.action}</td>
                    <td className="px-4 py-3 text-slate-300">{log.resourceKind}</td>
                    <td className="px-4 py-3 text-slate-200 font-semibold">{log.resourceName}</td>
                    <td className="px-4 py-3 text-slate-400">{log.namespace || 'cluster-wide'}</td>
                    <td className="px-4 py-3 font-sans">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1 ${
                          isSuccess
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : isBlocked
                            ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {isSuccess ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 text-xs font-mono">
                      {log.userId.substring(0, 10)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
