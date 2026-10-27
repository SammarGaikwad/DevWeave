import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  FileCode,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Server,
} from 'lucide-react';
import type {
  K8sNodeSummary,
  K8sNamespaceSummary,
  K8sEventSummary,
} from '../../services/kubernetesService';
import { K8sCreateNamespaceModal } from './K8sCreateNamespaceModal';
import { K8sConfirmModal } from './K8sConfirmModal';
import { K8sYamlModal } from './K8sYamlModal';

interface K8sClusterManagerProps {
  nodes: K8sNodeSummary[];
  namespaces: K8sNamespaceSummary[];
  events: K8sEventSummary[];
  selectedNamespace: string;
  searchTerm: string;
  onDeleteNamespace: (name: string) => Promise<void>;
  onRefresh: () => void;
}

export const K8sClusterManager: React.FC<K8sClusterManagerProps> = ({
  nodes,
  namespaces,
  events,
  selectedNamespace,
  searchTerm,
  onDeleteNamespace,
  onRefresh,
}) => {
  const [subTab, setSubTab] = useState<'nodes' | 'namespaces' | 'events'>('nodes');
  const [createNsOpen, setCreateNsOpen] = useState<boolean>(false);

  const [yamlModal, setYamlModal] = useState<{
    isOpen: boolean;
    kind: string;
    name: string;
    namespace?: string;
  }>({ isOpen: false, kind: '', name: '' });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionLabel: string;
    isProtected: boolean;
    namespaceName: string;
  }>({
    isOpen: false,
    title: '',
    description: '',
    actionLabel: '',
    isProtected: false,
    namespaceName: '',
  });

  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Filter namespaces and events
  const filteredNamespaces = namespaces.filter(
    (ns) => !searchTerm || ns.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredNodes = nodes.filter(
    (n) =>
      !searchTerm ||
      n.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.roles.some((r) => r.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredEvents = events.filter((ev) => {
    const matchNs = selectedNamespace === 'ALL' || ev.namespace === selectedNamespace;
    const matchSearch =
      !searchTerm ||
      ev.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.object.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.message.toLowerCase().includes(searchTerm.toLowerCase());
    return matchNs && matchSearch;
  });

  const handleConfirmDeleteNs = async () => {
    setActionLoading(true);
    try {
      await onDeleteNamespace(confirmModal.namespaceName);
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1 p-1 bg-slate-900/60 rounded-xl border border-slate-800 text-xs overflow-x-auto">
          <button
            onClick={() => setSubTab('nodes')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              subTab === 'nodes'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            Nodes ({filteredNodes.length})
          </button>
          <button
            onClick={() => setSubTab('namespaces')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              subTab === 'namespaces'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            Namespaces ({filteredNamespaces.length})
          </button>
          <button
            onClick={() => setSubTab('events')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              subTab === 'events'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            Cluster Events ({filteredEvents.length})
          </button>
        </div>

        {subTab === 'namespaces' && (
          <button
            onClick={() => setCreateNsOpen(true)}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition flex items-center space-x-1.5 shadow-lg shadow-indigo-900/30"
          >
            <Plus className="w-4 h-4" />
            <span>Create Namespace</span>
          </button>
        )}
      </div>

      {/* Nodes Table */}
      {subTab === 'nodes' && (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Node Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Roles</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Internal IP</th>
                <th className="px-4 py-3">Capacity (CPU / Mem)</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredNodes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No cluster nodes detected or runner is offline.
                  </td>
                </tr>
              ) : (
                filteredNodes.map((n) => {
                  const isReady = n.status === 'Ready';
                  return (
                    <tr key={n.name} className="hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3 font-semibold text-slate-200 flex items-center space-x-2 font-sans">
                        <Server className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span>{n.name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            isReady
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-red-500/10 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {n.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-indigo-300 text-xs">{n.roles.join(', ')}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{n.version}</td>
                      <td className="px-4 py-3 text-slate-300 text-xs">{n.internalIP || 'none'}</td>
                      <td className="px-4 py-3 text-slate-300 text-xs">
                        {n.cpuCapacity ? `${n.cpuCapacity} cores` : 'n/a'} / {n.memoryCapacity || 'n/a'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs font-sans">{n.age}</td>
                      <td className="px-4 py-3 text-right font-sans">
                        <button
                          onClick={() =>
                            setYamlModal({
                              isOpen: true,
                              kind: 'Node',
                              name: n.name,
                            })
                          }
                          title="Describe Node"
                          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Namespaces Table */}
      {subTab === 'namespaces' && (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Namespace</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Protection Policy</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredNamespaces.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No namespaces found.
                  </td>
                </tr>
              ) : (
                filteredNamespaces.map((ns) => {
                  const isProtected = ns.isProtected;
                  return (
                    <tr key={ns.name} className="hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3 font-semibold text-slate-200 flex items-center space-x-2 font-sans">
                        <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span className="font-mono">{ns.name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          {ns.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-sans">
                        {isProtected ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/30 inline-flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" /> System Critical
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">Standard Tenant</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs font-sans">{ns.age}</td>
                      <td className="px-4 py-3 text-right font-sans">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() =>
                              setYamlModal({
                                isOpen: true,
                                kind: 'Namespace',
                                name: ns.name,
                              })
                            }
                            title="Inspect Namespace"
                            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                          >
                            <FileCode className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              setConfirmModal({
                                isOpen: true,
                                title: `Delete Namespace`,
                                description: `Are you sure you want to delete namespace "${ns.name}"? ALL workloads, secrets, configmaps, and persistent volumes inside this namespace will be permanently destroyed.`,
                                actionLabel: 'Delete Namespace',
                                isProtected: !!isProtected,
                                namespaceName: ns.name,
                              })
                            }
                            title="Delete Namespace"
                            className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Cluster Events Stream */}
      {subTab === 'events' && (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Target Object</th>
                <th className="px-4 py-3">Namespace</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Count</th>
                <th className="px-4 py-3 text-right">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No recent cluster events recorded.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev, i) => {
                  const isWarning = ev.type === 'Warning';
                  return (
                    <tr key={i} className="hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1 ${
                            isWarning
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {isWarning ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                          {ev.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-200">{ev.reason}</td>
                      <td className="px-4 py-3 text-indigo-300 text-xs truncate max-w-xs">{ev.object}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{ev.namespace}</td>
                      <td className="px-4 py-3 text-slate-300 text-xs font-sans max-w-md break-words">{ev.message}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{ev.count}</td>
                      <td className="px-4 py-3 text-slate-500 text-[11px] text-right font-sans">
                        {new Date(ev.lastTimestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <K8sCreateNamespaceModal
        isOpen={createNsOpen}
        onClose={() => setCreateNsOpen(false)}
        onSuccess={() => onRefresh()}
      />

      <K8sYamlModal
        isOpen={yamlModal.isOpen}
        kind={yamlModal.kind}
        name={yamlModal.name}
        namespace={yamlModal.namespace}
        onClose={() => setYamlModal((prev) => ({ ...prev, isOpen: false }))}
      />

      <K8sConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        actionLabel={confirmModal.actionLabel}
        isDestructive={true}
        isProtected={confirmModal.isProtected}
        isLoading={actionLoading}
        onConfirm={handleConfirmDeleteNs}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
